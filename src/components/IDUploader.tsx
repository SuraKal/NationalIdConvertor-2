import { useState, useCallback, useRef } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface IDUploaderProps {
  label: string;
  onFileSelect: (file: File) => void;
  preview: string | null;
  onClear: () => void;
}

export function IDUploader({
  label,
  onFileSelect,
  preview,
  onClear,
}: IDUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && /\.(jpe?g|png)$/i.test(file.name)) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  if (preview) {
    return (
      <div className="relative rounded-lg overflow-hidden border-2 border-primary/20 bg-card">
        <p className="text-xs font-medium text-muted-foreground px-4 pt-3 uppercase tracking-wider">
          {label}
        </p>
        <img
          src={preview}
          alt={label}
          className="w-full h-auto max-h-[350px] object-contain mx-auto block p-4"
        />
        <button
          onClick={onClear}
          className="absolute top-3 right-3 rounded-full bg-foreground/80 p-1.5 transition-colors hover:bg-destructive"
        >
          <X className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-all duration-200",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <div className="rounded-full bg-primary/10 p-3">
        <Upload className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drop or click · JPG, PNG
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
