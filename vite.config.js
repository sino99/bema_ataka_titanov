import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,   // слушать все адреса (IPv4 + IPv6), можно открыть и с телефона в той же Wi-Fi
    port: 5173,
    open: true    // сам открывает браузер по правильной ссылке
  }
});
