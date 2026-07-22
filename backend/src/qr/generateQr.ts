import QRCode from 'qrcode';

export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    type: 'image/png',
    margin: 2,
    width: 300,
  });
}
