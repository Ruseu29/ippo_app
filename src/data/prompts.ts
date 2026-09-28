import buyingMittens from "./stories/buying-mittens/prompts.json";
import ameNiMoMakezu from "./stories/ame-ni-mo-makezu/prompts.json";
import kumoNoIto from "./stories/kumo-no-ito/prompts.json";
import yamanashi from "./stories/yamanashi/prompts.json";
import kyonenNoKi from "./stories/kyonen-no-ki/prompts.json";
import akaiRousoku from "./stories/akai-rousoku/prompts.json";
import nobara from "./stories/nobara/prompts.json";
import test from "./stories/test/prompts.json";

// 作品ごとのフォルダをここで登録する。配列の順番が作品・各編の表示順になる。
export const promptGroups = [
  { id: "test", title: "テスト", prompts: test },
  { id: "buying-mittens", title: "手袋を買いに", prompts: buyingMittens },
  { id: "ame-ni-mo-makezu", title: "雨ニモマケズ", prompts: ameNiMoMakezu },
  { id: "kumo-no-ito", title: "蜘蛛の糸", prompts: kumoNoIto },
  { id: "yamanashi", title: "やまなし", prompts: yamanashi },
  { id: "kyonen-no-ki", title: "去年の木", prompts: kyonenNoKi },
  { id: "akai-rousoku", title: "赤いろうそく", prompts: akaiRousoku },
  { id: "nobara", title: "野ばら", prompts: nobara },
];

// プレイログ・リプレイは、フォルダ構成に関係なく従来の文章IDで参照する。
const prompts = promptGroups.flatMap(group => group.prompts);
export default prompts;
