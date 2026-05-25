import { describe, expect, it } from "vitest";
import { selectAssetInventoryItems, selectAssetInventoryItemsForImport, type AssetInventoryItem } from "../asset-import";

const items: AssetInventoryItem[] = [
  {
    id: "asset-1",
    assetType: "photo",
    entityType: "member",
    entityId: "member-deputies-2004-297",
    legislature: "2004",
    legislatureId: "leg-2004-2008",
    chamber: "deputies",
    officialUrl: "https://cdep.ro/parlamentari/poza?idm=297"
  },
  {
    id: "asset-2",
    assetType: "party_logo",
    entityType: "member",
    entityId: "member-senate-2020-115",
    legislature: "2020",
    legislatureId: "leg-2020-2024",
    chamber: "senate",
    officialUrl: "https://cdep.ro/aleg/pnl2020.jpg"
  }
];

describe("asset import inventory selection", () => {
  it("filters by asset type and legislature without touching network or DB", () => {
    expect(selectAssetInventoryItems(items, { assetType: "photo", legislature: "2004" })).toEqual(items.slice(0, 1));
    expect(selectAssetInventoryItems(items, { legislature: "leg-2020-2024" })).toEqual(items.slice(1, 2));
  });

  it("applies a stable limit after filtering", () => {
    expect(selectAssetInventoryItems(items, { limit: 1 })).toEqual(items.slice(0, 1));
  });

  it("can batch by unique official URL with an offset", () => {
    const logoItem = items[1]!;
    const batched = selectAssetInventoryItemsForImport(
      [
        logoItem,
        { ...logoItem, id: "asset-3", entityId: "member-senate-2020-116" },
        { ...logoItem, id: "asset-4", officialUrl: "https://cdep.ro/aleg/usr2020.jpg" },
        { ...logoItem, id: "asset-5", officialUrl: "https://cdep.ro/aleg/psd2020.jpg" }
      ],
      { assetType: "party_logo", maxUniqueOfficialUrls: 1, uniqueOfficialUrlOffset: 1 }
    );

    expect(batched.map((item) => item.id)).toEqual(["asset-4"]);
  });
});
