// PartyKit 接続先。ローカルは `partykit dev`(127.0.0.1:1999)、本番はデプロイ先 URL。
// GitHub Pages ビルド時に VITE_PARTYKIT_HOST を注入する。
export const PARTYKIT_HOST =
  (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) ?? "127.0.0.1:1999";

const CLIENT_ID_KEY = "wardflux:clientId";

// 再接続で席を引き継ぐための安定した識別子。
export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `client-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  return localStorage.getItem("wardflux:name") ?? "";
}

export function setPlayerName(name: string): void {
  localStorage.setItem("wardflux:name", name);
}
