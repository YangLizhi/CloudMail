import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockEditorApi } = vi.hoisted(() => {
  const mockGetContent = vi.fn(() => "<p>editor html</p>");
  const mockSetContent = vi.fn();
  const mockInsertContent = vi.fn();
  const api = {
    getContent: mockGetContent,
    setContent: mockSetContent,
    insertContent: mockInsertContent,
    focus: vi.fn(),
    isEmpty: vi.fn(() => false),
    raw: vi.fn(() => ({})),
  };
  return { mockEditorApi: api };
});

vi.mock("@/components/composer/TinyMceEditor", async () => {
  const React = await import("react");
  return {
    TinyMceEditor: (props: {
      onReady?: (api: unknown) => void;
      onEditorChange?: (html: string) => void;
    }) => {
      React.useEffect(() => {
        props.onReady?.(mockEditorApi);
      }, [props.onReady]);
      return <div data-testid="editor-content">TinyMceEditor</div>;
    },
  };
});

vi.mock("@/components/ui/TextField", () => ({
  TextField: vi.fn((props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  )),
}));

const mockGetSignatures = vi.fn<() => Promise<import("@/services/db/signatures").DbSignature[]>>().mockResolvedValue([]);
const mockInsertSignature = vi.fn().mockResolvedValue(undefined);
const mockUpdateSignature = vi.fn().mockResolvedValue(undefined);
const mockDeleteSignature = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/db/signatures", () => ({
  getSignaturesForAccount: (...args: unknown[]) => mockGetSignatures(...(args as [])),
  insertSignature: (...args: unknown[]) => mockInsertSignature(...(args as [])),
  updateSignature: (...args: unknown[]) => mockUpdateSignature(...(args as [])),
  deleteSignature: (...args: unknown[]) => mockDeleteSignature(...(args as [])),
}));

import { useAccountStore } from "@/stores/accountStore";
import { SignatureEditor } from "./SignatureEditor";

describe("SignatureEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignatures.mockResolvedValue([]);
    mockEditorApi.getContent.mockReturnValue("<p>editor html</p>");
    mockEditorApi.setContent.mockClear();
    useAccountStore.setState({ activeAccountId: "acc-1" });
  });

  it("renders WYSIWYG mode by default with toggle button visible", () => {
    render(<SignatureEditor />);

    // Click "Add signature" to show the form
    fireEvent.click(screen.getByText("+ Add signature"));

    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    expect(screen.getByTitle("Edit HTML source")).toBeInTheDocument();
  });

  it("switches to HTML textarea when toggle is clicked", () => {
    render(<SignatureEditor />);
    fireEvent.click(screen.getByText("+ Add signature"));

    // Click the toggle to switch to HTML mode
    fireEvent.click(screen.getByTitle("Edit HTML source"));

    // Should show textarea, not editor
    expect(screen.queryByTestId("editor-content")).not.toBeInTheDocument();
    expect(screen.getByText("HTML source")).toBeInTheDocument();
    expect(screen.getByTitle("Switch to visual editor")).toBeInTheDocument();

    // Textarea should have the editor's HTML content
    const textarea = document.querySelector("textarea")!;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe("<p>editor html</p>");
  });

  it("switches back to WYSIWYG when toggled again", () => {
    render(<SignatureEditor />);
    fireEvent.click(screen.getByText("+ Add signature"));

    // Toggle to HTML mode
    fireEvent.click(screen.getByTitle("Edit HTML source"));

    // Edit the raw HTML
    const textarea = document.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "<b>custom html</b>" } });

    // Toggle back to WYSIWYG
    fireEvent.click(screen.getByTitle("Switch to visual editor"));

    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    expect(mockEditorApi.setContent).toHaveBeenCalledWith("<b>custom html</b>", false);
  });

  it("saves using textarea content when in HTML mode", async () => {
    render(<SignatureEditor />);
    fireEvent.click(screen.getByText("+ Add signature"));

    // Fill in the name
    fireEvent.change(screen.getByPlaceholderText("Signature name"), {
      target: { value: "My Sig" },
    });

    // Toggle to HTML mode
    fireEvent.click(screen.getByTitle("Edit HTML source"));

    // Edit the raw HTML
    const textarea = document.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "<table><tr><td>Sig</td></tr></table>" } });

    // Save
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockInsertSignature).toHaveBeenCalledWith({
        accountId: "acc-1",
        name: "My Sig",
        bodyHtml: "<table><tr><td>Sig</td></tr></table>",
        isDefault: false,
      });
    });
  });

  it("saves using editor.getContent() when in WYSIWYG mode", async () => {
    mockEditorApi.getContent.mockReturnValue("<p>wysiwyg content</p>");

    render(<SignatureEditor />);
    fireEvent.click(screen.getByText("+ Add signature"));

    fireEvent.change(screen.getByPlaceholderText("Signature name"), {
      target: { value: "My Sig" },
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockInsertSignature).toHaveBeenCalledWith({
        accountId: "acc-1",
        name: "My Sig",
        bodyHtml: "<p>wysiwyg content</p>",
        isDefault: false,
      });
    });
  });

  it("resets HTML mode state when cancel is clicked", () => {
    render(<SignatureEditor />);
    fireEvent.click(screen.getByText("+ Add signature"));

    // Toggle to HTML mode
    fireEvent.click(screen.getByTitle("Edit HTML source"));
    expect(document.querySelector("textarea")).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByText("Cancel"));

    // Re-open form — should be in WYSIWYG mode
    fireEvent.click(screen.getByText("+ Add signature"));
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });
});
