import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { IDUploader } from "@/components/IDUploader";
import { ResultsPanel } from "@/components/ResultsPanel";
import { extractIDData, type ExtractedData } from "@/lib/ocr";
import { useAuth } from "@/contexts/AuthContext";
import {
  ScanLine,
  Loader2,
  FileText,
  Shield,
  LogIn,
  LogOut,
  LayoutDashboard,
} from "lucide-react";

const Index = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [colorFile, setColorFile] = useState<File | null>(null);
  const [colorPreview, setColorPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<ExtractedData | null>(null);

  const handleFrontSelect = useCallback((f: File) => {
    setFrontFile(f);
    setFrontPreview(URL.createObjectURL(f));
    setResult(null);
  }, []);

  const handleBackSelect = useCallback((f: File) => {
    setBackFile(f);
    setBackPreview(URL.createObjectURL(f));
    setResult(null);
  }, []);

  const handleColorSelect = useCallback((f: File) => {
    setColorFile(f);
    setColorPreview(URL.createObjectURL(f));
    setResult(null);
  }, []);

  const handleClearFront = useCallback(() => {
    setFrontFile(null);
    setFrontPreview(null);
    setResult(null);
    setProgress(0);
    setStatus("");
  }, []);

  const handleClearBack = useCallback(() => {
    setBackFile(null);
    setBackPreview(null);
    setResult(null);
  }, []);

  const handleClearColor = useCallback(() => {
    setColorFile(null);
    setColorPreview(null);
    setResult(null);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!frontFile) return;
    setExtracting(true);
    setProgress(0);
    setStatus("Starting...");
    try {
      const data = await extractIDData(
        frontFile,
        backFile,
        colorFile,
        (p, s) => {
          setProgress(p);
          setStatus(s);
        },
      );
      setResult(data);
    } catch (err) {
      console.error("Extraction failed:", err);
      setStatus("Extraction failed. Please try a clearer image.");
    } finally {
      setExtracting(false);
    }
  }, [frontFile, backFile, colorFile]);

  const handleSignOut = async () => {
    await signOut();
  };

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Fayda ID Extractor
              </h1>
              <p className="text-xs text-muted-foreground">
                Ethiopian Digital ID · OCR
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <Shield className="h-3.5 w-3.5" />
              <span>Offline · No data sent</span>
            </div>
            {isLoggedIn ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="gap-1.5"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-1.5"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isLoggedIn && !authLoading && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Please{" "}
              <Link
                to="/login"
                className="text-primary hover:underline font-medium"
              >
                sign in
              </Link>{" "}
              or{" "}
              <Link
                to="/register"
                className="text-primary hover:underline font-medium"
              >
                register
              </Link>{" "}
              to use the ID extractor.
            </p>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left column - Upload */}
          <div className="space-y-4">
            {isLoggedIn ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <IDUploader
                    label="Front Side"
                    onFileSelect={handleFrontSelect}
                    preview={frontPreview}
                    onClear={handleClearFront}
                  />
                  <IDUploader
                    label="Back Side (Optional)"
                    onFileSelect={handleBackSelect}
                    preview={backPreview}
                    onClear={handleClearBack}
                  />
                </div>

                <IDUploader
                  label="Color ID Card (Optional · for colored photo)"
                  onFileSelect={handleColorSelect}
                  preview={colorPreview}
                  onClear={handleClearColor}
                />

                {frontFile && (
                  <div className="space-y-3">
                    <Button
                      onClick={handleExtract}
                      disabled={extracting}
                      className="w-full gap-2"
                      size="lg"
                    >
                      {extracting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ScanLine className="h-4 w-4" />
                      )}
                      {extracting
                        ? "Extracting..."
                        : `Extract Data${backFile ? " (Both Sides)" : " (Front Only)"}`}
                    </Button>

                    {extracting && (
                      <Card>
                        <CardContent className="pt-4 pb-4 space-y-2">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground text-center">
                            {status}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {!frontFile && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      How it works
                    </h3>
                    <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
                      <li>
                        Upload the front side of your Ethiopian Fayda ID card
                      </li>
                      <li>
                        Optionally upload the back side for QR code, phone &
                        address
                      </li>
                      <li>
                        Optionally upload the color version for colored profile
                        photo & QR
                      </li>
                      <li>Click "Extract Data" to run OCR analysis</li>
                      <li>View all extracted fields, photos, and codes</li>
                    </ol>
                    <p className="mt-3 text-xs text-muted-foreground">
                      ✦ All processing happens in your browser — nothing is
                      uploaded to any server.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
                <div className="text-center">
                  <LogIn className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sign in to upload and extract ID data
                  </p>
                  <Button asChild className="mt-4" size="sm">
                    <Link to="/login">Sign In</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Results */}
          <div>
            {result ? (
              <ResultsPanel data={result} onDataChange={setResult} />
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
                <div className="text-center">
                  <ScanLine className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Extracted data will appear here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
