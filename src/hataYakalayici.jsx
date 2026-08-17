import React from "react";
import { T } from "./tema.jsx";

/**
 * HATA YAKALAYICI — siyah ekranın panzehiri.
 *
 * SORUN: React'te bir bileşen çizilirken hata olursa React TÜM AĞACI söker. Sonuç bomboş
 * siyah bir sayfa: ne hata mesajı, ne geri dönüş, ne veri. Uygulamanın geri kalanı sapasağlam
 * olsa bile erişilemez hâle gelir.
 *
 * Bu proje boyunca siyah ekranların hepsi aynı türdendi: bir ad taşınırken geride kaldı ve
 * o bileşen ekrana gelene kadar hata ortaya çıkmadı. Statik denetleyiciler bu sınıfın bir
 * kısmını yakalıyor ama tarayıcıda çalıştırmadan hepsini yakalamak mümkün değil.
 *
 * ÇÖZÜM: hatayı bileşenin kendi sınırında durdurmak. Uygulamanın geri kalanı ayakta kalır,
 * kullanıcı hatanın ne olduğunu OKUR ve başka bir sekmeye geçebilir.
 *
 * Ayrıca hata metnini gösterir — "siyah ekran" demek yerine "X tanımlı değil" diyebilirsin,
 * bu da düzeltmeyi dakikalar yerine saniyelere indirir.
 */
export class HataYakalayici extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hata: null };
  }

  static getDerivedStateFromError(hata) {
    return { hata };
  }

  componentDidCatch(hata, bilgi) {
    // Konsola tam yığın izi — geliştirici araçlarından bakılabilsin.
    console.error("Bölüm çizilemedi:", hata, bilgi);
  }

  /* Sekme değişince hata temizlenir: bozuk bölümden çıkıp başka bir yere gidebilmelisin.
   * Aksi halde hata ekranı tüm oturum boyunca yapışık kalırdı. */
  componentDidUpdate(oncekiProps) {
    if (oncekiProps.anahtar !== this.props.anahtar && this.state.hata) {
      this.setState({ hata: null });
    }
  }

  render() {
    if (!this.state.hata) return this.props.children;

    const mesaj = String(this.state.hata && this.state.hata.message ? this.state.hata.message : this.state.hata);
    return (
      <div style={{ padding: "18px 22px", background: T.dangerSoft, border: `1px solid ${T.danger}`, borderRadius: 16, maxWidth: 640 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: T.text, marginBottom: 8 }}>
          Bu bölüm açılamadı
        </div>
        <div style={{ fontSize: 13, color: T.textDim, fontFamily: "Inter, sans-serif", lineHeight: 1.7, marginBottom: 12 }}>
          Uygulamanın geri kalanı çalışıyor — soldaki menüden başka bir bölüme geçebilirsin.
          Verilerine bir şey olmadı.
        </div>
        <div style={{ fontSize: 13, color: T.danger, fontFamily: "'IBM Plex Mono', monospace", background: T.surface, borderRadius: 9, padding: "12px 15px", wordBreak: "break-word", marginBottom: 12 }}>
          {mesaj}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => this.setState({ hata: null })}
            style={{ padding: "12px 15px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceRaised, color: T.text, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Tekrar dene
          </button>
          <button
            onClick={() => { try { navigator.clipboard.writeText(mesaj); } catch (e) { /* yoksay */ } }}
            style={{ padding: "12px 15px", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Hata metnini kopyala
          </button>
        </div>
      </div>
    );
  }
}
