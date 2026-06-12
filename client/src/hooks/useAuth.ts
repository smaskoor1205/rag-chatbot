import { useEffect, useState } from "react";
import type { User } from "../types";
import * as client from "../api";

const KEY = "rag-auth";

export function useAuth() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { token: string; user: User };
      setToken(parsed.token);
      setUser(parsed.user);
    }
  }, []);

  function persist(nextToken: string, nextUser: User) {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  }

  return {
    token,
    user,
    async login(email: string, password: string) {
      const result = await client.login(email, password);
      persist(result.token, result.user);
    },
    async register(email: string, name: string, password: string) {
      const result = await client.register(email, name, password);
      persist(result.token, result.user);
    },
    logout() {
      localStorage.removeItem(KEY);
      setToken("");
      setUser(null);
    }
  };
}
