// Se ejecuta una vez al arrancar el servidor, antes de atender peticiones (ver instrumentation-node.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { arrancar } = await import("./instrumentation-node");
    await arrancar();
  }
}
