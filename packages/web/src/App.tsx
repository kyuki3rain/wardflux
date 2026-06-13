import { useEffect } from "react";
import { useStore } from "./store.js";
import { HomeScreen } from "./screens/HomeScreen.js";
import { DeckBuilderScreen } from "./screens/DeckBuilderScreen.js";
import { LobbyScreen } from "./screens/LobbyScreen.js";
import { GameScreen } from "./screens/GameScreen.js";

export function App() {
  const screen = useStore((s) => s.screen);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  return (
    <div className="min-h-screen">
      {screen === "home" && <HomeScreen />}
      {screen === "deckbuilder" && <DeckBuilderScreen />}
      {screen === "lobby" && <LobbyScreen />}
      {screen === "game" && <GameScreen />}

      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-red-600/95 px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
