# Karar 004: RAG ve Bilgi Getirme Stratejisi

## Bağlam
DocAI, kullanıcı sorularını yüklenen belgelerin içeriğine dayanarak yanıtlamalıdır. İlgili metin parçalarının doğru ve hızlı bulunması, cevapların güvenilirliği açısından önemlidir.

## Seçenekler

**A — Embedding Tabanlı Vektör Araması**
- Artı: Kelimeler farklı olsa bile anlamsal benzerlikleri bulabilir.
- Eksi: Embedding üretimi ek işlem gerektirir.

**B — Anahtar Kelime Araması**
- Artı: Basit ve hızlıdır.
- Eksi: Farklı ifadelerle yazılmış ilgili içerikleri kaçırabilir.

**C — Hibrit Arama**
- Artı: Vektör ve anahtar kelime aramasını birleştirir.
- Eksi: Daha karmaşık bir arama altyapısı gerektirir.

## Karar
**Embedding tabanlı vektör araması** seçilmiştir.

Kullanıcı sorusu embedding'e dönüştürülür ve PostgreSQL + pgvector üzerinden cosine distance kullanılarak en ilgili 5 chunk (Top-K=5) getirilir.

Anahtar kelime araması anlamsal eşleşmelerde yetersiz kalabileceği, hibrit arama ise mevcut proje için ek karmaşıklık oluşturacağı için tercih edilmemiştir.

## Sonuçları
- **Avantaj:** Soruyla anlamsal olarak ilişkili belge içerikleri bulunabilir.
- **Ödün:** Sonuçların kalitesi embedding modeline ve chunking yöntemine bağlıdır.
- **Yeniden değerlendirme:** İlgisiz kaynaklar sık getirildiğinde veya arama doğruluğu yetersiz kaldığında hibrit arama ve reranking değerlendirilecektir.