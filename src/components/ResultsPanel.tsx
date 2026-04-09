import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { User, Calendar, Hash, ScanBarcode, Phone, Globe, MapPin, QrCode, Pencil, Check, Upload } from "lucide-react";
import type { ExtractedData } from "@/lib/ocr";
import { PrintableID } from "./PrintableID";

interface ResultsPanelProps {
  data: ExtractedData;
  onDataChange: (data: ExtractedData) => void;
}

function EditableField({
  label,
  value,
  icon,
  onSave,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
      {icon && <div className="mt-0.5 text-primary">{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {editing ? (
          <div className="flex items-center gap-2 mt-0.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="h-7 text-sm"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="shrink-0 rounded-md p-1 text-primary hover:bg-primary/10 transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-0.5 group">
            <p className="text-sm font-semibold text-foreground break-all flex-1">
              {value || <span className="text-muted-foreground italic font-normal">Not detected</span>}
            </p>
            <button
              onClick={() => { setDraft(value); setEditing(true); }}
              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-all"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditableImageCard({
  label,
  icon,
  src,
  alt,
  maxH,
  onReplace,
  extra,
}: {
  label: string;
  icon?: React.ReactNode;
  src: string;
  alt: string;
  maxH: string;
  onReplace: (dataUrl: string) => void;
  extra?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!src) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onReplace(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative group">
          <img src={src} alt={alt} className={`w-full ${maxH} object-contain rounded-md border border-border`} />
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-foreground/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow">
              <Upload className="h-3.5 w-3.5" />
              Replace
            </div>
          </button>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
        {extra}
      </CardContent>
    </Card>
  );
}

export function ResultsPanel({ data, onDataChange }: ResultsPanelProps) {
  const hasBackData = data.qr_code_image || data.phone_number || data.nationality || data.fin_number || data.address.region;

  const update = (field: string, value: string) => {
    if (field.startsWith("address.")) {
      const addrField = field.split(".")[1];
      onDataChange({
        ...data,
        address: { ...data.address, [addrField]: value },
      });
    } else {
      onDataChange({ ...data, [field]: value });
    }
  };

  return (
    <div className="space-y-4">
      <PrintableID data={data} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EditableField label="Full Name (Amharic)" value={data.full_name_amharic} icon={<User className="h-4 w-4" />} onSave={(v) => update("full_name_amharic", v)} />
          <EditableField label="Full Name (English)" value={data.full_name_english} icon={<User className="h-4 w-4" />} onSave={(v) => update("full_name_english", v)} />
          <EditableField label="Sex" value={data.sex} onSave={(v) => update("sex", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EditableField label="Date of Birth (Ethiopian)" value={data.date_of_birth_ethiopian} icon={<Calendar className="h-4 w-4" />} onSave={(v) => update("date_of_birth_ethiopian", v)} />
          <EditableField label="Date of Birth (Gregorian)" value={data.date_of_birth_gregorian} icon={<Calendar className="h-4 w-4" />} onSave={(v) => update("date_of_birth_gregorian", v)} />
          <EditableField label="Date of Issue (Ethiopian)" value={data.date_of_issue_ethiopian} icon={<Calendar className="h-4 w-4" />} onSave={(v) => update("date_of_issue_ethiopian", v)} />
          <EditableField label="Date of Issue (Gregorian)" value={data.date_of_issue_gregorian} icon={<Calendar className="h-4 w-4" />} onSave={(v) => update("date_of_issue_gregorian", v)} />
          <EditableField label="Date of Expiry (Ethiopian)" value={data.date_of_expiry_ethiopian} icon={<Calendar className="h-4 w-4" />} onSave={(v) => update("date_of_expiry_ethiopian", v)} />
          <EditableField label="Date of Expiry (Gregorian)" value={data.date_of_expiry_gregorian} icon={<Calendar className="h-4 w-4" />} onSave={(v) => update("date_of_expiry_gregorian", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Identification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EditableField label="FAN Number" value={data.fan_number} icon={<Hash className="h-4 w-4" />} onSave={(v) => update("fan_number", v)} />
          {hasBackData && (
            <EditableField label="FIN Number" value={data.fin_number} icon={<Hash className="h-4 w-4" />} onSave={(v) => update("fin_number", v)} />
          )}
        </CardContent>
      </Card>

      {hasBackData && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Contact & Nationality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <EditableField label="Phone Number" value={data.phone_number} icon={<Phone className="h-4 w-4" />} onSave={(v) => update("phone_number", v)} />
              <EditableField label="Nationality" value={data.nationality} icon={<Globe className="h-4 w-4" />} onSave={(v) => update("nationality", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <EditableField label="Region (English)" value={data.address.region} icon={<MapPin className="h-4 w-4" />} onSave={(v) => update("address.region", v)} />
              <EditableField label="Region (Amharic)" value={data.address.region_amharic} icon={<MapPin className="h-4 w-4" />} onSave={(v) => update("address.region_amharic", v)} />
              <EditableField label="Zone (English)" value={data.address.zone} icon={<MapPin className="h-4 w-4" />} onSave={(v) => update("address.zone", v)} />
              <EditableField label="Zone (Amharic)" value={data.address.zone_amharic} icon={<MapPin className="h-4 w-4" />} onSave={(v) => update("address.zone_amharic", v)} />
              <EditableField label="Woreda (English)" value={data.address.woreda} icon={<MapPin className="h-4 w-4" />} onSave={(v) => update("address.woreda", v)} />
              <EditableField label="Woreda (Amharic)" value={data.address.woreda_amharic} icon={<MapPin className="h-4 w-4" />} onSave={(v) => update("address.woreda_amharic", v)} />
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <EditableImageCard
          label="Profile Photo (Grayscale)"
          src={data.profile_image}
          alt="Profile"
          maxH="max-h-48"
          onReplace={(dataUrl) => update("profile_image", dataUrl)}
        />
        {data.profile_image_color && (
          <EditableImageCard
            label="Profile Photo (Color)"
            src={data.profile_image_color}
            alt="Profile Color"
            maxH="max-h-48"
            onReplace={(dataUrl) => update("profile_image_color", dataUrl)}
          />
        )}
        <EditableImageCard
          label="Barcode"
          icon={<ScanBarcode className="h-4 w-4" />}
          src={data.barcode_image}
          alt="Barcode"
          maxH="max-h-24"
          onReplace={(dataUrl) => update("barcode_image", dataUrl)}
          extra={data.barcode_value ? <Badge variant="secondary" className="mt-2">{data.barcode_value}</Badge> : null}
        />
        <EditableImageCard
          label="QR Code"
          icon={<QrCode className="h-4 w-4" />}
          src={data.qr_code_image}
          alt="QR Code"
          maxH="max-h-48"
          onReplace={(dataUrl) => update("qr_code_image", dataUrl)}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Raw JSON Output</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-foreground/5 p-3 text-xs overflow-auto max-h-64 text-foreground font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
