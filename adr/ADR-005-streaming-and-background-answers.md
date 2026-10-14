# Karar 005: Streaming ve Arka Planda Cevap Üretimi

## Bağlam
DocAI'de yapay zekâ cevaplarının üretilmesi zaman alabilir. Kullanıcıların cevap tamamlanana kadar beklemeden uygulamayı kullanabilmesi ve belgeler arasında geçiş yapabilmesi gerekir.

## Seçenekler

**A — Standart HTTP İsteği**
- Artı: Basit ve kolay uygulanabilir.
- Eksi: Cevap tamamlanana kadar kullanıcı bekler.

**B — Server-Sent Events (SSE)**
- Artı: Cevaplar parça parça iletilebilir ve kullanıcıya anlık gösterilebilir.
- Eksi: Bağlantı ve hata yönetimi gerektirir.

**C — WebSocket**
- Artı: Çift yönlü, gerçek zamanlı iletişim sağlar.
- Eksi: Bu kullanım için gereksiz bağlantı yönetimi karmaşıklığı oluşturabilir.

## Karar
**SSE ve belge bazlı bağımsız cevap yönetimi** seçilmiştir.

AI cevapları SSE üzerinden parça parça alınır. Her belgenin cevap üretim durumu ve sohbet geçmişi ayrı yönetilir. Böylece kullanıcı başka bir belgeye geçse bile devam eden cevap üretimi korunur.

Standart HTTP, aşamalı cevap gösterimini sağlamadığı; WebSocket ise çift yönlü iletişim gerekmeyen bu senaryoda daha karmaşık olduğu için tercih edilmemiştir.

## Sonuçları
- **Avantaj:** Daha akıcı kullanıcı deneyimi ve belgeler arasında kesintisiz geçiş.
- **Ödün:** Eşzamanlı isteklerin, bağlantıların ve hata durumlarının ayrı yönetilmesi gerekir.
- **Yeniden değerlendirme:** Çok sayıda eşzamanlı kullanıcı nedeniyle performans sorunları yaşanırsa arka plan görev kuyruğu veya farklı iletişim yöntemleri değerlendirilecektir.