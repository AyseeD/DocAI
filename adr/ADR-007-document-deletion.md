# Karar 007: Belge Silme ve Geri Yükleme Stratejisi

## Bağlam
DocAI'de kullanıcılar yanlışlıkla belge silebilir. Belgelerin hemen kalıcı olarak silinmesi veri kaybına neden olabileceğinden geri yükleme imkânı sunulmalıdır.

## Seçenekler

**A — Doğrudan Kalıcı Silme**
- Artı: Basit ve depolama alanını hemen boşaltır.
- Eksi: Yanlışlıkla silinen belgeler kurtarılamaz.

**B — Süresiz Soft Delete**
- Artı: Silinen belgeler geri yüklenebilir.
- Eksi: Veriler sürekli saklandığından depolama ihtiyacı artar.

**C — Süreli Soft Delete**
- Artı: Geri yükleme imkânı sunarken depolama kullanımını sınırlar.
- Eksi: Süre dolan belgeler için otomatik temizleme gerekir.

## Karar
**10 günlük süreli soft delete** yöntemi seçilmiştir.

Silinen belgeler Trash bölümüne taşınır ve 10 gün boyunca geri yüklenebilir. Kullanıcı isterse belgeyi daha önce kalıcı olarak silebilir. Süresi dolan belgeler temizleme mekanizmasıyla kaldırılır.

Doğrudan silme veri kaybı riski taşıdığı, süresiz saklama ise gereksiz depolama oluşturduğu için tercih edilmemiştir.

## Sonuçları
- **Avantaj:** Yanlışlıkla silinen belgeler kurtarılabilir.
- **Ödün:** Silinen belgeler belirli bir süre depolama alanı kullanmaya devam eder.
- **Yeniden değerlendirme:** Depolama maliyeti, kullanıcı ihtiyaçları veya veri saklama politikaları değiştiğinde süre yeniden değerlendirilecektir.