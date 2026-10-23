# GO24 Mobile App 交接

更新日期：2026-09-29

## 目前進度
會員 App 使用 NestJS、React Native／Expo 與 PGM 整合。另為 THE LAB 品牌推出第二個 App 的可行性已初步研究，尚未決定採用同一 PGM tenant 或分開 tenant；因此沒有開始品牌分隔實作。

## 已處理
- 若 THE LAB 會所與 GO24／ONYX 位於同一 tenant，技術上可做第二個品牌介面，但會所清單、課堂表及 Club Finder 都必須按品牌限制資料。
- 已整理向管理層及 PGM 查詢的英文草稿；尚未寄出，亦未收到 PGM 對 tenant、品牌 App 費用及會所資料隔離的確認。
- 現有架構與主要功能說明保留在 HANDOFF.md。

## 下一步
先確認管理層是否接受同一 tenant 的品牌隔離方案，再由 PGM 確認第二個品牌 App、clubId 過濾、費用及上架安排。取得答案後才更新 app 的品牌設定與課堂查詢。

## 相關檔案
- HANDOFF.md
- apps/member-app/app/(tabs)/classes.tsx
- backend/nest-api/src/bookings/