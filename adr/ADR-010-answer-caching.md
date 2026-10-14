# Karar 010: Cevap Önbellekleme Stratejisi

## Bağlam
DocAI'de aynı belgeye tekrar tekrar benzer sorular sorulabilir. Her soruda yeniden AI cevabı üretmek, yanıt süresini ve API kullanım maliyetini artırabilir.

## Seçenekler

**A — Önbellek Kullanmamak**
- Artı: Her zaman yeni cevap üretilir.
- Eksi: Tekrarlanan sorular gereksiz işlem maliyeti oluşturur.

**B — Bellek İçi Önbellek**
- Artı: Hızlı ve kolay uygulanabilir.
- Eksi: Uygulama yeniden başlatıldığında veriler kaybolabilir.

**C — PostgreSQL Tabanlı Önbellek**
- Artı: Cevaplar kalıcı saklanabilir ve ilgili kaynaklarla ilişkilendirilebilir.
- Eksi: Önbellek geçerliliği ve temizliği yönetilmelidir.

## Karar
**PostgreSQL tabanlı cevap önbellekleme** yöntemi seçilmiştir.

Tekrarlanan sorular için daha önce oluşturulmuş cevaplar ve kaynak bilgileri veritabanından alınabilir. Böylece gereksiz cevap üretimi azaltılır.

Bellek içi önbelleğin kalıcı olmaması ve önbelleksiz yaklaşımın ek maliyet oluşturması nedeniyle PostgreSQL tercih edilmiştir.

## Sonuçları
- **Avantaj:** Daha hızlı yanıtlar ve daha az AI çağrısı.
- **Ödün:** Eski cevapların geçerliliğinin ve belge değişikliklerinin yönetilmesi gerekir.
- **Yeniden değerlendirme:** Önbellek büyüdüğünde, yanlış cevaplar tekrarlandığında veya güncellik sorunları yaşandığında strateji gözden geçirilecektir.