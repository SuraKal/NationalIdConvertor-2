import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Printer, Download } from "lucide-react";
import type { ExtractedData } from "@/lib/ocr";
import { toGregorian, toEthiopian } from "ethiopian-calendar-new";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PrintableIDProps {
  data: ExtractedData;
}

// Positions are percentages of the full template image (both sides combined)
// Template is split: left = front, right = back

const TEMPLATE_URL = "/images/id-template.jpg";
function ethiopianToGregorian(ethDate) {
  const [y, m, d] = ethDate.replace(/\s/g, "").split("/").map(Number);

  const { year, month, day } = toGregorian(y, m, d);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  // Add leading zero to day if less than 10
  const formattedDay = String(day).padStart(2, "0");

  return `${year}/${months[month - 1]}/${formattedDay}`;
}

function drawTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  xPct: number,
  yPct: number,
  canvasW: number,
  canvasH: number,
  fontSize: number = 14,
  color: string = "#1a1a1a",
  font: string = "sans-serif",
) {
  if (!text) return;
  ctx.font = `${fontSize}px ${font}`;
  ctx.fillStyle = color;
  ctx.fillText(text, canvasW * xPct, canvasH * yPct);
}

function drawImageOnCanvas(
  ctx: CanvasRenderingContext2D,
  imgSrc: string,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  canvasW: number,
  canvasH: number,
): Promise<void> {
  return new Promise((resolve) => {
    if (!imgSrc) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        canvasW * xPct,
        canvasH * yPct,
        canvasW * wPct,
        canvasH * hPct,
      );
      resolve();
    };
    img.onerror = () => resolve();
    img.src = imgSrc;
  });
}
function drawTextOnCanvasBold(
  ctx,
  text,
  xPercent,
  yPercent,
  w,
  h,
  fontSize,
  color,
) {
  const x = w * xPercent;
  const y = h * yPercent;
  ctx.font = `bold ${fontSize}px sans-serif`; // bold here
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function PrintableID({ data }: PrintableIDProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [useColorPhoto, setUseColorPhoto] = useState(false);
  const hasColorProfile = !!data.profile_image_color;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const templateImg = new Image();
    templateImg.onload = async () => {
      const w = templateImg.naturalWidth;
      const h = templateImg.naturalHeight;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(templateImg, 0, 0);

      const fontSize = Math.round(h * 0.032);
      const smallFont = Math.round(h * 0.025);
      const FANFont = Math.round(h * 0.035);
      const color = "#1a1a1a";
      // Randomly create 7 digit serial number for bottom right of back side
      const SN = Math.floor(1000000 + Math.random() * 9000000).toString();
      drawTextOnCanvasBold(
        ctx,
        SN,
        0.925,
        0.958,
        w,
        h,
        Math.round(h * 0.0449),
        color,
      );

      // === FRONT SIDE (left half) ===
      // Full Name (Amharic) - below "ሙሉ ስም | Full Name" label
      drawTextOnCanvas(
        ctx,
        data.full_name_amharic,
        0.192,
        0.32,
        w,
        h,
        Math.round(h * 0.0449),
        color,
      );
      // Full Name (English)
      drawTextOnCanvasBold(
        ctx,
        data.full_name_english,
        0.192,
        0.37,
        w,
        h,
        Math.round(h * 0.0449),
        color,
      );
      // Date of Birth - below "ት/ወልድ ቀን | Date of Birth"
      const dobText = [
        data.date_of_birth_ethiopian,
        data.date_of_birth_gregorian,
      ]
        .filter(Boolean)
        .join(" | ");
      drawTextOnCanvasBold(
        ctx,
        dobText,
        0.192,
        0.53,
        w,
        h,
        Math.round(h * 0.04),
        color,
      );

      // Sex - below "ጾታ | Sex"
      // show a combined string with data.sex_amharic | data.sex
      const sexText = [data.sex_amharic, data.sex].filter(Boolean).join(" | ");

      drawTextOnCanvasBold(
        ctx,
        sexText,
        0.192,
        0.63,
        w,
        h,
        Math.round(h * 0.04),
        color,
      );
      const expText = [
        data.date_of_expiry_gregorian,
        data.date_of_expiry_ethiopian,
      ]
        .filter(Boolean)
        .join(" | ");
      // Date of Expiry - below "የሚያበቃበት ቀን | Date of Expiry"
      drawTextOnCanvasBold(
        ctx,
        expText,
        0.192,
        0.74,
        w,
        h,
        Math.round(h * 0.04),
        color,
      );

      // FAN Number - bottom area

      // Profile photo - use color or grayscale based on toggle
      const profileSrc =
        useColorPhoto && data.profile_image_color
          ? data.profile_image_color
          : data.profile_image;

      // Profile photo - top left area
      await drawImageOnCanvas(ctx, profileSrc, 0.023, 0.26, 0.159, 0.66, w, h);

      // Small Profile photo - bottom left area
      await drawImageOnCanvas(ctx, profileSrc, 0.389, 0.72, 0.056, 0.23, w, h);

      const spacedFan = data.fan_number
        ? data.fan_number.split("").join(" ")
        : "";

      // Barcode - bottom center of front side
      // FAN Number (above barcode)
      drawTextOnCanvas(ctx, spacedFan, 0.22, 0.848, w, h, FANFont, color);

      // Barcode
      await drawImageOnCanvas(
        ctx,
        data.barcode_image,
        0.22,
        0.85,
        0.132,
        0.1,
        w,
        h,
      );
      // === BACK SIDE (right half) ===
      // Phone Number
      drawTextOnCanvasBold(
        ctx,
        data.phone_number,
        0.528,
        0.15,
        w,
        h,
        Math.round(h * 0.0446),
        color,
      );

      // Nationality
      const nationalityText = [data.nationality_amharic, data.nationality]
        .filter(Boolean)
        .join(" | ");

      drawTextOnCanvasBold(
        ctx,
        nationalityText,
        0.528,
        0.29,
        w,
        h,
        Math.round(h * 0.0444),
        color,
      );

      if (data.address.region_amharic) {
        drawTextOnCanvasBold(
          ctx,
          `${data.address.region_amharic}`,
          0.528,
          0.4,
          w,
          h,
          Math.round(h * 0.0444),
          color,
        );
      }

      // Address
      if (data.address.region) {
        drawTextOnCanvasBold(
          ctx,
          `${data.address.region}`,
          0.528,
          0.45,
          w,
          h,
          Math.round(h * 0.0444),
          color,
        );
      }

      if (data.address.zone_amharic) {
        drawTextOnCanvasBold(
          ctx,
          `${data.address.zone_amharic}`,
          0.528,
          0.5,
          w,
          h,
          Math.round(h * 0.0444),
          color,
        );
      }
      if (data.address.zone) {
        drawTextOnCanvasBold(
          ctx,
          `${data.address.zone}`,
          0.528,
          0.55,
          w,
          h,
          Math.round(h * 0.0444),
          color,
        );
      }
      if (data.address.woreda_amharic) {
        drawTextOnCanvasBold(
          ctx,
          `${data.address.woreda_amharic}`,
          0.528,
          0.6,
          w,
          h,
          Math.round(h * 0.0444),
          color,
        );
      }
      if (data.address.woreda) {
        drawTextOnCanvasBold(
          ctx,
          `${data.address.woreda}`,
          0.528,
          0.65,
          w,
          h,
          Math.round(h * 0.0444),
          color,
        );
      }

      // QR Code - right side center area
      await drawImageOnCanvas(
        ctx,
        data.qr_code_image,
        0.733,
        0.06,
        0.259,
        0.82,
        w,
        h,
      );

      // FIN Number - bottom of back side
      // drawTextOnCanvas(
      //   ctx,
      //   data.fin_number,
      //   0.62,
      //   0.85,
      //   w,
      //   h,
      //   smallFont,
      //   0.528,
      //   0.71,
      // );

      // Date of Issue (vertical on far left of front, but we show it horizontally here)
      const issueTextEt = data.date_of_issue_ethiopian;
      if (issueTextEt) {
        ctx.save();

        ctx.translate(w * 0.018, h * 0.81);
        ctx.rotate(-Math.PI / 2);

        const fontSize = Math.round(h * 0.03);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = color;

        const text = issueTextEt;
        const spacing = 1; // adjust spacing here (pixels)

        let x = 0;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          ctx.fillText(char, x, 0);
          x += ctx.measureText(char).width + spacing;
        }

        ctx.restore();
      }

      if (issueTextEt) {
        // Convert result.date_of_expiry_ethiopian to gregorian calender and add to data.date_of_issue_gregorian
        const issueTextGr = ethiopianToGregorian(issueTextEt);
        if (issueTextGr) {
          ctx.save();

          ctx.translate(w * 0.018, h * 0.39);
          ctx.rotate(-Math.PI / 2);

          const fontSize = Math.round(h * 0.03);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = color;

          const text = issueTextGr;
          const spacing = 1; // adjust spacing here (pixels)

          let x = 0;

          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            ctx.fillText(char, x, 0);
            x += ctx.measureText(char).width + spacing;
          }

          ctx.restore();
        }
      }

      setReady(true);
    };
    templateImg.src = TEMPLATE_URL;
  }, [data, useColorPhoto]);

  const handlePrint = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to print.");
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = !!roleData;

      if (!isAdmin) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance, total_downloads")
          .eq("user_id", user.id)
          .single();

        if (!profile || profile.wallet_balance < 1) {
          toast.error("Insufficient credits. Please top up your wallet.");
          return;
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            wallet_balance: profile.wallet_balance - 1,
            total_downloads: (profile.total_downloads ?? 0) + 1,
          })
          .eq("user_id", user.id);

        if (updateError) {
          toast.error("Failed to process print.");
          console.error(updateError);
          return;
        }
      } else {
        // Admin: just increment total_downloads
        const { data: profile } = await supabase
          .from("profiles")
          .select("total_downloads")
          .eq("user_id", user.id)
          .single();
        if (profile) {
          await supabase
            .from("profiles")
            .update({ total_downloads: (profile.total_downloads ?? 0) + 1 })
            .eq("user_id", user.id);
        }
      }

      await supabase.from("downloads").insert({
        user_id: user.id,
        file_name: "fayda-id-card-print.png",
      });

      const dataUrl = canvas.toDataURL("image/png");
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fayda ID Card</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
      printWindow.document.close();

      toast.success(isAdmin ? "Printing!" : "Printing! 1 credit deducted.");
    } catch (err) {
      console.error("Failed to print:", err);
      toast.error("Print failed.");
    }
  };

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to download.");
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = !!roleData;

      if (!isAdmin) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance, total_downloads")
          .eq("user_id", user.id)
          .single();

        if (!profile || profile.wallet_balance < 1) {
          toast.error("Insufficient credits. Please top up your wallet.");
          return;
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            wallet_balance: profile.wallet_balance - 1,
            total_downloads: (profile.total_downloads ?? 0) + 1,
          })
          .eq("user_id", user.id);

        if (updateError) {
          toast.error("Failed to process download.");
          console.error(updateError);
          return;
        }
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("total_downloads")
          .eq("user_id", user.id)
          .single();
        if (profile) {
          await supabase
            .from("profiles")
            .update({ total_downloads: (profile.total_downloads ?? 0) + 1 })
            .eq("user_id", user.id);
        }
      }

      // Track download
      await supabase.from("downloads").insert({
        user_id: user.id,
        file_name: "fayda-id-card.png",
      });

      // Trigger actual download
      const link = document.createElement("a");
      link.download = "fayda-id-card.png";
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success(isAdmin ? "Downloaded!" : "Downloaded! 1 credit deducted.");
    } catch (err) {
      console.error("Failed to download:", err);
      toast.error("Download failed.");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Printer className="h-5 w-5 text-primary" />
          Printable ID Card
        </CardTitle>
        {hasColorProfile && (
          <div className="flex items-center gap-2 mt-2">
            <Switch
              id="color-toggle"
              checked={useColorPhoto}
              onCheckedChange={setUseColorPhoto}
            />
            <Label
              htmlFor="color-toggle"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              {useColorPhoto ? "Color Photo" : "Grayscale Photo"}
            </Label>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-border overflow-hidden bg-muted/30">
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>
        {ready && (
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2 flex-1">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="gap-2 flex-1"
            >
              Download PNG
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
