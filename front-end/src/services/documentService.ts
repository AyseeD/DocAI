
// Backend upload endpoint'i henüz hazır değil.
// Bu fonksiyon, API sözleşmesi netleşene kadar
// gerçek yükleme yapılmadığını açıkça bildirir.

export async function uploadDocument(_file: File): Promise<never> {
  throw new Error('Document upload API is not available yet.')
}
