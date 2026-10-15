# Karar 009: Mock Mode ve Harici AI Servisi Bağımlılığı

## Bağlam
DocAI, embedding oluşturma ve cevap üretme işlemlerinde harici AI servislerinden yararlanır. Ancak API anahtarları, servis kesintileri ve kullanım limitleri geliştirme ve test süreçlerini zorlaştırabilir.

## Seçenekler

**A — Yalnızca Gerçek AI Servisi**
- Artı: Gerçek model davranışı test edilir.
- Eksi: İnternet, API erişimi ve kullanım limitlerine bağımlıdır.

**B — Yalnızca Mock Mode**
- Artı: Hızlı, tekrarlanabilir ve düşük maliyetli testler sağlar.
- Eksi: Gerçek AI modelinin davranışını tam olarak yansıtmaz.

**C — Gerçek AI Servisi + Mock Mode**
- Artı: Hem gerçek kullanım hem de bağımsız geliştirme ve test imkânı sunar.
- Eksi: İki çalışma modunun tutarlı şekilde yönetilmesi gerekir.

## Karar
**Gerçek AI servisi ve Mock Mode'un birlikte desteklenmesi** seçilmiştir.

Normal kullanımda OpenRouter üzerinden AI işlemleri gerçekleştirilir. Mock Mode ise harici servise bağımlı olmadan geliştirme ve test yapılmasını sağlar.

Yalnızca gerçek servis kullanımı geliştirmeyi dış bağımlılıklara açık hâle getirdiği, yalnızca mock kullanımı ise gerçek model davranışını doğrulamadığı için tercih edilmemiştir.

## Sonuçları
- **Avantaj:** Daha kolay test, düşük geliştirme maliyeti ve harici servislerden bağımsız çalışma.
- **Ödün:** Mock sonuçları gerçek AI performansını temsil etmez.
- **Yeniden değerlendirme:** AI sağlayıcısı değiştiğinde veya test ihtiyaçları genişlediğinde mock davranışı güncellenecektir.