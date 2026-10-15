# Karar 008: Prompt Injection Güvenliği

## Bağlam
DocAI, kullanıcıların yüklediği belgeleri yapay zekâ ile işler. Belgeler, modeli yönlendirmeye veya sistem talimatlarını değiştirmeye çalışan zararlı ifadeler içerebilir. Bu nedenle güvenilmeyen belge içeriklerine karşı koruma gereklidir.

## Seçenekler

**A — Doğrudan İşleme**
- Artı: Basit ve hızlıdır.
- Eksi: Zararlı talimatların modeli etkileme riski vardır.

**B — Prompt ile Koruma**
- Artı: Modele belge içeriğini yalnızca veri olarak değerlendirmesi söylenebilir.
- Eksi: Tek başına yeterli güvenlik sağlamaz.

**C — İçerik Taraması ve Prompt Koruması**
- Artı: Şüpheli ifadeler tespit edilebilir ve modele ek güvenlik sınırları uygulanabilir.
- Eksi: Yanlış pozitif sonuçlar ve ek işlem maliyeti oluşabilir.

## Karar
**Belge içeriği taraması ve güvenli prompt yaklaşımı** tercih edilmiştir.

Belge içerikleri olası prompt injection girişimlerine karşı taranır. Şüpheli içerikler için uyarı mekanizması kullanılır. Belgelerdeki talimatların sistem talimatlarının önüne geçmemesi hedeflenir.

Yalnızca prompt koruması veya doğrudan işleme, güvenlik açısından yeterli görülmemiştir.

## Sonuçları
- **Avantaj:** Zararlı içeriklerin tespit edilmesi ve kullanıcıların uyarılması sağlanır.
- **Ödün:** Bazı güvenli ifadeler yanlışlıkla şüpheli olarak işaretlenebilir.
- **Yeniden değerlendirme:** Yeni saldırı yöntemleri ortaya çıktığında veya yanlış pozitif oranı arttığında tarama kuralları güncellenecektir.