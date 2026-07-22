import QRCode from 'qrcode';
export async function generateQrDataUrl(url) {
    return QRCode.toDataURL(url, {
        type: 'image/png',
        margin: 2,
        width: 300,
    });
}
//# sourceMappingURL=generateQr.js.map