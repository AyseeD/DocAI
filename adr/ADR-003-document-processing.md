# Karar 003: Belge İşleme ve Chunking Stratejisi

## Bağlam
DocAI, PDF ve TXT belgelerinden metin çıkararak kullanıcı sorularını yanıtlar. Uzun belgelerin tamamını doğrudan AI modeline göndermek verimsiz olduğundan metinlerin daha küçük parçalara (chunk) ayrılması gerekir.

## Seçenekler

**A — Sabit Boyutlu Chunking**
- Artı: Basit, hızlı ve kolay uygulanabilir.
- Eksi: Cümleler veya paragraflar bölünebilir.

**B — Recursive Chunking**
- Artı: Metnin yapısını mümkün olduğunca koruyarak parçalama yapar.
- Eksi: Daha karmaşık bir işleme süreci gerektirir.

**C — Semantic Chunking**
- Artı: Anlamsal bütünlüğü korumayı hedefler.
- Eksi: Daha fazla işlem gücü ve maliyet gerektirebilir.

## Karar
Kelime tabanlı, örtüşmeli (overlapping) chunking yöntemi seçilmiştir.

Metinler en fazla 180 kelimelik parçalara ayrılır. Parçalar arasında 30 kelimelik örtüşme kullanılarak bağlam kaybı azaltılır. PDF belgelerinde sayfa numaraları korunur ve her chunk için embedding oluşturulur.

Basitliği ve düşük işlem maliyeti nedeniyle bu yöntem tercih edilmiştir. Recursive ve semantic chunking yöntemleri daha karmaşık veya maliyetli olabileceğinden seçilmemiştir.

## Sonuçları
- **Avantaj:** Belgeler aranabilir parçalara dönüştürülür ve RAG sürecinde kullanılabilir.
- **Ödün:** Parçalama sırasında bazı bağlamsal ilişkiler kaybolabilir.
- **Yeniden değerlendirme:** Kaynak bulma doğruluğu düşük kaldığında veya farklı belge türlerinde sorun yaşandığında chunk boyutu ve yöntemi yeniden değerlendirilecektir.