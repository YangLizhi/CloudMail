use std::path::{Path, PathBuf};
use tauri::Manager;

const DB_FILES: [&str; 3] = ["cloudmail.db", "cloudmail.db-wal", "cloudmail.db-shm"];

fn is_link(p: &Path) -> bool {
    std::fs::symlink_metadata(p)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
}

fn ensure_dir(target: &Path) -> Result<(), String> {
    std::fs::create_dir_all(target).map_err(|e| format!("无法创建目录 {}: {e}", target.display()))
}

fn move_db_files(from: &Path, to: &Path) -> Result<(), String> {
    for name in DB_FILES {
        let src = from.join(name);
        let dst = to.join(name);
        if !src.exists() {
            continue;
        }
        if dst.exists() {
            // Keep a safety backup of any pre-existing destination file.
            let _ = std::fs::rename(&dst, to.join(format!("{name}.old")));
        }
        std::fs::copy(&src, &dst).map_err(|e| format!("复制 {name} 失败: {e}"))?;
        std::fs::remove_file(&src).map_err(|e| format!("删除旧的 {name} 失败: {e}"))?;
    }
    Ok(())
}

fn create_storage_link(link: &Path, target: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // `mklink /J` creates a directory junction without admin rights. Use
        // raw_arg so the paths aren't re-escaped by the Runtime.
        let cmd_line = format!("mklink /J \"{}\" \"{}\"", link.display(), target.display());
        let out = std::process::Command::new("cmd")
            .raw_arg("/C")
            .raw_arg(&cmd_line)
            .output()
            .map_err(|e| format!("创建目录联接失败: {e}"))?;
        if !out.status.success() {
            return Err(format!(
                "创建目录联接失败（退出码 {:?}）：{}",
                out.status.code(),
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        std::os::unix::fs::symlink(target, link).map_err(|e| format!("创建符号链接失败: {e}"))?;
        Ok(())
    }
}

fn remove_storage_link(link: &Path) -> Result<(), String> {
    if !link.exists() {
        return Ok(());
    }
    if is_link(link) {
        // For a junction/symlink, `remove_dir` removes only the link itself,
        // never the pointed-to contents.
        return std::fs::remove_dir(link).map_err(|e| format!("移除目录联接失败: {e}"));
    }
    // A real directory: after db files were moved out it should be (nearly) empty.
    // Clear any known db files first (they may be read-only on some setups).
    for name in DB_FILES {
        let f = link.join(name);
        if f.exists() {
            if let Ok(mut p) = std::fs::metadata(&f).map(|m| m.permissions()) {
                p.set_readonly(false);
                let _ = std::fs::set_permissions(&f, p);
            }
            let _ = std::fs::remove_file(&f);
        }
    }
    match std::fs::remove_dir(link) {
        Ok(()) => Ok(()),
        Err(_) => std::fs::remove_dir_all(link).map_err(|e| format!("移除目录失败: {e}")),
    }
}

/// Change where the mail database actually lives. The app always opens
/// `data/cloudmail.db` (relative to its AppData dir); `data` is a junction
/// that points at `target_dir`, so the real bytes land there.
#[tauri::command]
pub fn set_db_location(app: tauri::AppHandle, target_dir: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let data_link = data_dir.join("data");
    let target = PathBuf::from(&target_dir);

    ensure_dir(&target)?;

    // If the current storage already resolves to this target, nothing to do.
    let resolved_current = std::fs::read_link(&data_link).unwrap_or_else(|_| data_link.clone());
    if resolved_current == target {
        return Ok(());
    }

    // Whether the target already holds a database (e.g. a leftover from a
    // previously failed move). If so, keep it — no need to overwrite.
    let target_has_db = target.join("cloudmail.db").exists();

    // Source of the db files: a marker file tracks whether the user chose a
    // custom location. If so, read through the `data` junction (previous custom
    // location); otherwise the default AppData-root db.
    let marker = data_dir.join("cloudmail-db-dir.txt");
    let currently_custom = std::fs::read_to_string(&marker)
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let source = if currently_custom && data_link.exists() {
        data_link.clone()
    } else {
        data_dir.clone()
    };

    // Replace `data` with a junction pointing at the new target.
    remove_storage_link(&data_link)?;
    create_storage_link(&data_link, &target)?;

    // Only move the current source db into the target if the target doesn't
    // already have one. This makes a failed earlier attempt recoverable.
    if !target_has_db {
        move_db_files(&source, &target)?;
    }

    Ok(())
}
