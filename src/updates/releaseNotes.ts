import { PRODUCT_VERSION } from "../about/productInfo";
import type { LanguageId } from "../i18n/languages";
import type { LocalizedReleaseNotes } from "./types";

export const CURRENT_RELEASE_NOTES: Record<
  LanguageId,
  LocalizedReleaseNotes
> = {
  "zh-CN": {
    version: PRODUCT_VERSION,
    releaseDate: "2026-09-24",
    sections: {
      features: ["新增主题相对界面亮度与安全重置设置。"],
      improvements: ["统一五语言设置文案、弹窗和下拉菜单体验。"],
      fixes: ["修复常规设置的持久化与默认值恢复逻辑。"]
    }
  },
  "zh-TW": {
    version: PRODUCT_VERSION,
    releaseDate: "2026-09-24",
    sections: {
      features: ["新增主題相對介面亮度與安全重設設定。"],
      improvements: ["統一五語言設定文案、彈窗與下拉選單體驗。"],
      fixes: ["修正常規設定的儲存與預設值恢復邏輯。"]
    }
  },
  en: {
    version: PRODUCT_VERSION,
    releaseDate: "2026-09-24",
    sections: {
      features: ["Added theme-relative interface brightness and safe reset."],
      improvements: ["Unified settings copy, dialogs, and menus across five languages."],
      fixes: ["Fixed general preference persistence and default restoration."]
    }
  },
  ja: {
    version: PRODUCT_VERSION,
    releaseDate: "2026-09-24",
    sections: {
      features: ["テーマ基準の画面明るさと安全な設定リセットを追加。"],
      improvements: ["5 言語の設定文言、ダイアログ、メニュー体験を統一。"],
      fixes: ["一般設定の保存と初期値復元ロジックを修正。"]
    }
  },
  ko: {
    version: PRODUCT_VERSION,
    releaseDate: "2026-09-24",
    sections: {
      features: ["테마 기준 화면 밝기와 안전한 설정 초기화를 추가했습니다."],
      improvements: ["5개 언어의 설정 문구, 대화상자, 메뉴 경험을 통일했습니다."],
      fixes: ["일반 설정 저장 및 기본값 복원 로직을 수정했습니다."]
    }
  }
};
