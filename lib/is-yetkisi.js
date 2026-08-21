/**
 * OPERASYON KARTINI KİM İŞLEYEBİLİR
 *
 * Tek kaynak: aynı kuralı iki yere yazmak bu projede zaten bir kez panel senkron hatasına
 * yol açtı. Ayrıca burada durduğu için Node testinden çağrılabiliyor — kural bir JSX
 * dosyasının içinde kalsaydı yalnızca kaynak metnine bakan bir test yazılabilirdi ve bu
 * projede öyle testler iddia ettikleri şeyi hiç sınamadan geçtiler.
 *
 * ESKİ KURAL VE NEDEN DEĞİŞTİ:
 * Personel bir kartı ancak o kartın "Sorumlu Kameraman" ya da "Sorumlu Editör" alanında
 * ADI YAZIYORSA işleyebiliyordu; Operasyon yetkisine hiç bakılmıyordu. Üç sonucu vardı:
 *
 *   1. Operasyon yetkisi verilen personel hiçbir kartı ilerletemiyordu — aşama düğmeleri
 *      çizilmiyor, medya yükleyici kapalı geliyordu. Yetki ekranındaki kutucuk açık olduğu
 *      için sebebi anlaşılmıyordu.
 *   2. Kartı OLUŞTURAN kişi kendi kartında kilitli kalıyordu: yeni iş formunda kameraman ve
 *      editör boş başlıyor, yani oluşturan kişi o saniye "atanmamış" sayılıyordu. Dışarıdan
 *      "iş oluşturulamıyor" gibi görünüyordu.
 *   3. Eşleşme serbest metin üzerinde birebir karşılaştırmaydı: hesap adı "İbrahim",
 *      kartta "İbrahim Gümüş" yazıyorsa hiçbir zaman tutmuyordu.
 *
 * YENİ KURAL: Operasyon yetkisi olan personel GÖRDÜĞÜ her kartı işler.
 *
 * MARKA KİLİDİ BAĞIMSIZ ÇALIŞIYOR: kilitli hesap zaten yalnızca kendi markalarının
 * kartlarını görüyor (sunucu süzüyor), dolayısıyla "gördüğü her kart" onun markalarıyla
 * sınırlı. Bu kural o sınırı genişletmiyor.
 *
 * GÜVENLİK SINIRI BURASI DEĞİL: sunucu, cekimEdit izni olmayan bir hesabın `cekimIsleri`
 * alanına yazmasını zaten reddediyor (PERMISSION_WRITE_FIELDS). Burası bir iş kuralı.
 * Kart SİLME bu kuralın dışında — yalnızca yönetici siliyor.
 *
 * Kameraman/editör alanları duruyor: kimin sorumlu olduğu hâlâ kayıtlı, sadece artık
 * kimin çalışabileceğini belirlemiyor.
 */
export function kartiIsleyebilirMi(role, islemYetkisi) {
  if (role === "owner") return true;
  return islemYetkisi === true;
}
