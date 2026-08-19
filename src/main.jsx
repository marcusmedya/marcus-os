import React from "react";
import ReactDOM from "react-dom/client";
import MarcusOS from "./App.jsx";
import { tekrarDenemeyiKur } from "../lib/mesgul-tekrar.js";

/* Sunucu yoğunken 503 dönen istekleri kendiliğinden tekrar dener — kullanıcı yoğun
 * anlarda gereksiz "kaydedilemedi" hatası görmesin. Uygulama açılmadan ÖNCE kurulur. */
tekrarDenemeyiKur();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MarcusOS />
  </React.StrictMode>
);
