import {
  getLayerActionId,
  LAYER_ACTIONS,
  type LayerAction
} from "../layerActionTypes";
import type { NyaActionDefinition } from "../types";

const TITLES: Record<LayerAction, NyaActionDefinition["title"]> = {
  "create-text": { zhCN: "新建文字层", zhTW: "新增文字圖層", en: "Create Text Layer", ja: "テキストレイヤーを作成", ko: "텍스트 레이어 만들기" },
  "create-solid": { zhCN: "新建纯色层", zhTW: "新增純色圖層", en: "Create Solid Layer", ja: "平面レイヤーを作成", ko: "단색 레이어 만들기" },
  "create-shape": { zhCN: "新建形状层", zhTW: "新增形狀圖層", en: "Create Shape Layer", ja: "シェイプレイヤーを作成", ko: "도형 레이어 만들기" },
  "create-adjustment": { zhCN: "新建调整层", zhTW: "新增調整圖層", en: "Create Adjustment Layer", ja: "調整レイヤーを作成", ko: "조정 레이어 만들기" },
  "create-null": { zhCN: "新建空对象", zhTW: "新增空物件", en: "Create Null Controller", ja: "ヌルコントローラーを作成", ko: "널 컨트롤러 만들기" },
  "create-camera-rig": { zhCN: "新建摄像机", zhTW: "新增攝影機", en: "Create Camera Rig", ja: "カメラリグを作成", ko: "카메라 리그 만들기" },
  "create-light": { zhCN: "新建灯光", zhTW: "新增燈光", en: "Create Light", ja: "ライトを作成", ko: "조명 만들기" },
  "precompose-selected": { zhCN: "预合成", zhTW: "預合成", en: "Pre-compose Selected", ja: "選択レイヤーをプリコンポーズ", ko: "선택 레이어 프리컴포즈" },
  "unprecompose-selected": { zhCN: "解预合成", zhTW: "解除預合成", en: "Unprecompose Selected", ja: "プリコンポーズを解除", ko: "프리컴포즈 해제" }
};

const DESCRIPTIONS: Record<LayerAction, NyaActionDefinition["title"]> = {
  "create-text": { zhCN: "创建居中的 text 文字层", zhTW: "建立置中的 text 文字圖層", en: "Create a centered text layer", ja: "中央にテキストレイヤーを作成", ko: "중앙에 텍스트 레이어 만들기" },
  "create-solid": { zhCN: "创建黑色纯色层并添加填充效果", zhTW: "建立黑色純色圖層並加入填色效果", en: "Create a black solid with Fill", ja: "塗りエフェクト付きの黒い平面を作成", ko: "채우기 효과가 있는 검은 단색 만들기" },
  "create-shape": { zhCN: "创建带参数控制的形状层", zhTW: "建立具有參數控制的形狀圖層", en: "Create a parameterized shape", ja: "パラメーター付きシェイプを作成", ko: "매개변수 도형 만들기" },
  "create-adjustment": { zhCN: "创建调整图层", zhTW: "建立調整圖層", en: "Create an adjustment layer", ja: "調整レイヤーを作成", ko: "조정 레이어 만들기" },
  "create-null": { zhCN: "创建参考线空对象并可绑定选中图层", zhTW: "建立參考線空物件並可綁定選取圖層", en: "Create a guide Null controller", ja: "ガイドヌルコントローラーを作成", ko: "가이드 널 컨트롤러 만들기" },
  "create-camera-rig": { zhCN: "创建摄像机与三维空对象控制器", zhTW: "建立攝影機與 3D 空物件控制器", en: "Create a camera and 3D controller", ja: "カメラと3Dコントローラーを作成", ko: "카메라와 3D 컨트롤러 만들기" },
  "create-light": { zhCN: "创建灯光图层", zhTW: "建立燈光圖層", en: "Create a light layer", ja: "ライトレイヤーを作成", ko: "조명 레이어 만들기" },
  "precompose-selected": { zhCN: "将选中图层预合成", zhTW: "將選取圖層預合成", en: "Pre-compose selected layers", ja: "選択レイヤーをプリコンポーズ", ko: "선택 레이어 프리컴포즈" },
  "unprecompose-selected": { zhCN: "安全提取预合成内部图层", zhTW: "安全取出預合成內部圖層", en: "Safely extract precomp layers", ja: "プリコンポーズ内のレイヤーを安全に展開", ko: "프리컴포즈 레이어 안전하게 추출" }
};

const ICONS: Record<LayerAction, string> = {
  "create-text": "TextT",
  "create-solid": "Rectangle",
  "create-shape": "BoundingBox",
  "create-adjustment": "SlidersHorizontal",
  "create-null": "AnchorSimple",
  "create-camera-rig": "VideoCamera",
  "create-light": "Lightbulb",
  "precompose-selected": "ProjectorScreen",
  "unprecompose-selected": "StackMinus"
};

export const LAYER_ACTION_DEFINITIONS: readonly NyaActionDefinition[] =
  LAYER_ACTIONS.map((action) => ({
    id: getLayerActionId(action),
    title: TITLES[action],
    description: DESCRIPTIONS[action],
    icon: ICONS[action],
    category: action === "precompose-selected" || action === "unprecompose-selected"
      ? "composition"
      : action === "create-text"
        ? "text"
        : action === "create-shape"
          ? "shape"
          : action === "create-camera-rig"
            ? "camera"
            : "layer",
    requirements: action === "precompose-selected" || action === "unprecompose-selected"
      ? ["host", "activeComp", "selectedLayers"]
      : ["host", "activeComp"],
    supportsPie: true,
    execute: {
      type: "host",
      command: "runLayerAction",
      payload: { action }
    },
    undoPolicy: "host-undo-group"
  }));
