# Windowsのローカル実行環境

`start-ippo.bat` をダブルクリックする。初回だけ依存関係を取得し、ブラウザを開く。
終了は起動したウィンドウを閉じるか、Ctrl+C。初回の取得にはインターネットが必要。

ソースと `src/data/corrections.json` は今までの共有フォルダで編集する。
JSONの保存後、ブラウザを再読み込みして新しい辞書で試す。サーバーの再起動は不要。
ルートの設定ファイル・`.env`・依存関係を変更したら
batを起動し直す。公開ページを更新する手順はこれまでどおりGitHubへのpush。

## 保存先

- ソース・Git：現在の共有フォルダ。
- Node.js・pnpm：既存の `%USERPROFILE%\miniconda3\envs\ippo` を優先。
- `node_modules`・Viteキャッシュ・`dist`・TypeScriptの生成物：
  `%LOCALAPPDATA%\IPPO\environments\ippo-<ソースのパスから作るID>`。
- pnpmのストアとキャッシュ：`%LOCALAPPDATA%\IPPO\pnpm-*`。

C側にだけディレクトリジャンクションを作り、共有フォルダの `src`・`tests`・`supabase`・
`public`（存在する場合）を参照する。共有フォルダにはリンクも依存関係も作らない。
ルートの設定ファイルは起動時にC側へコピーする。依存関係はlockfileどおりに取得し、
設定やツールの版が変わった場合に再インストールする。同じ環境の同時起動はできない。
ソースのパスを移動した場合は、新しいIDの環境を作る。

今回、共有フォルダにあった旧 `node_modules`・`.pnpm-store`・`dist`・`tsconfig.tsbuildinfo` は
C側の `%LOCALAPPDATA%\IPPO\legacy-20260929-065247` に退避した。新しい環境では使わない。

## 別のPC

Node.js 24とpnpm 11.19.0をC側に用意する。conda環境がない場合はPATH上のものを使う。
別のインストール先は環境変数 `IPPO_NODE_HOME` で指定できる。
Google Driveからソースを利用可能にして、同じbatを起動する。依存関係はそのPCで取得する。

## 開発用コマンド

共有フォルダ内で直接 `pnpm install` を実行すると、そこに `node_modules` ができるため、
Windowsでは次の入口を使う。

```powershell
.\start-ippo.bat prepare  # C側の環境を準備するだけ
.\start-ippo.bat test     # テスト
.\start-ippo.bat build    # 型確認とビルド（distもC側）
.\start-ippo.bat ui-test  # 本番に接続しない模擬DBでのUI確認
.\start-ippo.bat dev -NoOpen # ブラウザを開かず起動
```

GitHub Actionsは通常の `pnpm install` / `pnpm build` を引き続き使う。
