import { useEffect, useState } from "react";
import { appApi } from "@/api/appClient";

export default function SignedImage({ fileUri, alt = "", className = "", fit = "cover" }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!fileUri) {
      setUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    appApi.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri })
      .then((res) => {
        if (active) {
          setUrl(res?.signed_url || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setUrl(null);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [fileUri]);

  if (!fileUri) return null;
  if (loading) return <div className={`bg-slate-100 animate-pulse ${className}`} />;
  if (!url) return <div className={`bg-slate-100 flex items-center justify-center text-slate-400 text-xs ${className}`}>ไม่สามารถโหลดรูป</div>;
  return <img src={url} alt={alt} className={`object-${fit} ${className}`} />;
}