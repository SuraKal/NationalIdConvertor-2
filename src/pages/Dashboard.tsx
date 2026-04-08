import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, LogOut, ScanLine, Wallet, Shield } from "lucide-react";
import WalletTopUp from "@/components/WalletTopUp";

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [downloadCount, setDownloadCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [{ count }, { data: profile }, { data: roleData }] = await Promise.all([
        supabase
          .from("downloads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("name, wallet_balance, total_downloads")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("user_roles" as any)
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      setDownloadCount(count ?? 0);
      setWalletBalance(profile?.wallet_balance ?? 0);
      setTotalDownloads(profile?.total_downloads ?? 0);
      setProfileName(profile?.name || user.user_metadata?.name || "User");
      setIsAdmin(!!roleData);
    };

    fetchData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
              <p className="text-xs text-muted-foreground">Welcome, {profileName}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-3 max-w-3xl">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <span className="text-3xl font-bold text-foreground">{walletBalance}</span>
                  <p className="text-xs text-muted-foreground">credits</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Downloads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Download className="h-8 w-8 text-primary" />
                <span className="text-3xl font-bold text-foreground">{totalDownloads}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Joined {new Date(user?.created_at ?? "").toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {!isAdmin && (
          <div className="mt-8 max-w-3xl">
            <WalletTopUp />
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Button onClick={() => navigate("/")} className="gap-2">
            <ScanLine className="h-4 w-4" />
            Go to ID Extractor
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => navigate("/admin")} className="gap-2">
              <Shield className="h-4 w-4" />
              Admin Panel
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
