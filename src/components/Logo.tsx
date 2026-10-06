import Image from "next/image";
import mark from "@/assets/sas-mark.png";

/**
 * Logo PT Sahada Laku Utama.
 *
 * Memakai tanda heksagon saja, tanpa wordmark, karena logo tampil pada
 * kotak kecil (34px) dan teks "SAHADA" tidak terbaca pada ukuran itu.
 */
export function Logo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={mark}
      alt="Logo PT Sahada Laku Utama"
      width={size}
      height={size}
      loading="eager"
      className={className}
    />
  );
}
