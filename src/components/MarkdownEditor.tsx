import OverType from "overtype";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (offset: number) => void;
}

export function MarkdownEditor({ value, onChange, onCursorChange }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);

    useEffect(() => {
      const [instance] = OverType.init(ref.current!, {
        value,
        onChange,
        theme: {
            name: "my-theme",
            colors: {
                bgPrimary: 'var(--color-neutral-800)',
                bgSecondary: 'var(--color-neutral-800)',
                text: 'var(--color-white)',
                h1: 'var(--color-primary)',
                h2: 'var(--color-secondary)',
                h3: 'var(--color-tertiary)',
                strong: 'var(--color-primary)',
                em: 'var(--color-secondary)',
                link: 'var(--color-primary)',
                code: 'var(--color-secondary)',
                codeBg: 'var(--color-tertiary)',
                blockquote: 'var(--color-primary)',
                hr: 'var(--color-secondary)',
                syntaxMarker: 'var(--color-tertiary)',
                cursor: 'var(--color-primary)',
                selection: 'var(--color-secondary)',
              }

        }
      });
      editorRef.current = instance;

      // Track cursor position
      const textarea = instance.textarea;
      const handleCursor = () => {
        onCursorChange?.(textarea.selectionStart);
      };
      textarea.addEventListener('keyup', handleCursor);
      textarea.addEventListener('mouseup', handleCursor);
      textarea.addEventListener('select', handleCursor);

      return () => {
        textarea.removeEventListener('keyup', handleCursor);
        textarea.removeEventListener('mouseup', handleCursor);
        textarea.removeEventListener('select', handleCursor);
        editorRef.current?.destroy();
      };
    }, []);

    useEffect(() => {
      if (editorRef.current && value !== editorRef.current.getValue()) {
        editorRef.current.setValue(value);
      }
    }, [value]);

    return <div ref={ref} style={{ height: '100%', width: '100%' }} />;
  }
