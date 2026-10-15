# Karar 006: Kaynak Doğrulama ve Yeniden Deneme Mekanizması

## Bağlam
DocAI'nin ürettiği cevapların yüklenen belgelere dayanması ve doğru kaynakları göstermesi gerekir. Yapay zekâ bazen kaynak numarası eklemeyebilir veya geçersiz referanslar üretebilir.

## Seçenekler

**A — Kaynakları Kontrol Etmeden Gösterme**
- Artı: Basit ve hızlıdır.
- Eksi: Yanlış veya eksik kaynaklar kullanıcıya gösterilebilir.

**B — Kaynak Doğrulama**
- Artı: Geçersiz kaynak referansları tespit edilebilir.
- Eksi: Hatalı cevaplarda ek işlem gerekir.

**C — Kaynak Doğrulama ve Otomatik Retry**
- Artı: Eksik kaynaklar için yeniden cevap üretimi denenebilir.
- Eksi: Ek gecikme ve AI kullanım maliyeti oluşturabilir.

## Karar
**Kaynak doğrulama ve tek seferlik otomatik retry** yöntemi seçilmiştir.

Üretilen cevapların kaynak referansları kontrol edilir. Gerekli kaynaklar eksikse cevap yeniden üretilmeye çalışılır. Yeniden deneme sayısı sınırlandırılarak gereksiz isteklerin önüne geçilir.

Doğrulamasız gösterim güvenilirliği azaltacağı, yalnızca doğrulama ise eksik kaynakları düzeltmeye çalışmayacağı için tercih edilmemiştir.

## Sonuçları
- **Avantaj:** Kaynak gösteriminin güvenilirliği artırılır.
- **Ödün:** Yeniden deneme gerektiğinde cevap süresi ve işlem maliyeti artabilir.
- **Yeniden değerlendirme:** Retry oranı yükselirse veya kaynak hataları devam ederse prompt yapısı ve doğrulama yöntemi gözden geçirilecektir.