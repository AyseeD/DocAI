# Karar 002: Veritabanı ve Vektör Depolama

## Bağlam
DocAI'de belgelerin bilgilerini, metin parçalarını (chunks) ve embedding vektörlerini saklamamız gerekiyor. RAG sisteminin benzer içerikleri hızlıca bulabilmesi ve verilerin tutarlı yönetilmesi önemli.

## Seçenekler

**A — PostgreSQL + pgvector**
- Artı: İlişkisel veriler ve vektörler tek veritabanında tutulabilir.
- Eksi: Büyük veri hacimlerinde performans optimizasyonu gerekebilir.

**B — PostgreSQL + Pinecone**
- Artı: Vektör araması için özel olarak geliştirilmiş yönetilen servis.
- Eksi: Ek servis bağımlılığı ve maliyet oluşturabilir.

**C — PostgreSQL + Chroma**
- Artı: Kolay kurulum ve RAG projelerine uygun yapı.
- Eksi: İki ayrı veri deposunun yönetilmesini gerektirir.

## Karar
**PostgreSQL + pgvector** seçilmiştir.

Belge bilgilerini, chunk'ları ve embedding vektörlerini aynı veritabanında yönetebildiğimiz için bu çözümü tercih ettik. Pinecone ve Chroma, mevcut proje ölçeğinde gereksiz ek altyapı oluşturabileceğinden seçilmedi.

## Sonuçları
- **Avantaj:** Tek veritabanı, daha basit veri yönetimi ve daha az servis bağımlılığı.
- **Ödün:** Vektör arama performansının izlenmesi ve gerektiğinde optimize edilmesi gerekir.
- **Yeniden değerlendirme:** Belge sayısı ve sorgu yükü önemli ölçüde arttığında alternatif vektör depoları yeniden değerlendirilecektir.