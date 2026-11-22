import { getRequestConfig } from "next-intl/server";
import { IDIOMAS, type Idioma } from "./idiomas";

export default getRequestConfig(async ({ requestLocale }) => {
  const pedido = await requestLocale;
  const locale: Idioma = IDIOMAS.includes(pedido as Idioma) ? (pedido as Idioma) : "es";
  const messages = (await import(`./mensajes/${locale}.json`)).default;
  return { locale, messages, timeZone: "America/La_Paz" };
});
