# Karar 001: Teknoloji Yığını ve Sistem Mimarisi

## Bağlam
DocAI, kullanıcıların PDF ve TXT belgeleri yükleyerek içerikleri hakkında soru sorabildiği bir RAG uygulamasıdır. Hızlı geliştirilebilen, sürdürülebilir ve yapay zekâ entegrasyonuna uygun bir mimariye ihtiyaç duyulmuştur.

## Seçenekler

**A — React + FastAPI + PostgreSQL**
- Artı: Modern arayüz, Python ile kolay AI entegrasyonu, pgvector desteği.
- Eksi: Frontend ve backend ayrı yönetilir.

**B — Next.js + Node.js + MongoDB**
- Artı: JavaScript tabanlı bütünleşik geliştirme.
- Eksi: Python tabanlı AI araçlarıyla entegrasyon ek iş gerektirebilir.

**C — Django + PostgreSQL**
- Artı: Hazır backend özellikleri ve güçlü veritabanı desteği.
- Eksi: Projenin ihtiyaçlarına göre daha kapsamlı bir yapı sunar.

## Karar
**React + TypeScript + Vite, FastAPI ve PostgreSQL + pgvector** seçilmiştir.

React esnek bir arayüz geliştirmeyi, FastAPI Python tabanlı RAG işlemlerini, PostgreSQL ise belge verilerini ve vektörleri birlikte saklamayı sağlar.

Diğer seçenekler, mevcut geliştirme ihtiyaçları açısından daha fazla uyarlama gerektirebileceği için tercih edilmemiştir.

## Sonuçları
- **Avantaj:** Modüler, geliştirilebilir ve AI entegrasyonuna uygun yapı.
- **Ödün:** Frontend, backend ve veritabanı servisleri ayrı yönetilmelidir.
- **Yeniden değerlendirme:** Kullanıcı sayısı, veri hacmi veya performans ihtiyaçları mevcut mimariyi yetersiz bıraktığında karar gözden geçirilmelidir.