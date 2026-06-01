import { asc, inArray } from "drizzle-orm";
import { parseBillText, scoreOcrHealth } from "@cumsevoteaza/parliament-model";
import * as schema from "@cumsevoteaza/db";
import { confidenceForDocument, type SourceConfidence } from "./source-confidence";
import { createWebDbSession } from "./server-db";

export async function getDocumentConfidenceMap(documentIds: string[]): Promise<Map<string, SourceConfidence>> {
  const uniqueIds = [...new Set(documentIds.filter(Boolean))];
  if (uniqueIds.length === 0 || !process.env.DATABASE_URL) return new Map();

  const session = createWebDbSession();
  try {
    const documents = await session.db
      .select({
        id: schema.documents.id,
        textStatus: schema.documents.textStatus
      })
      .from(schema.documents)
      .where(inArray(schema.documents.id, uniqueIds));
    const reviewRows = await session.db
      .select({
        entityId: schema.dataHealthReviews.entityId,
        status: schema.dataHealthReviews.status
      })
      .from(schema.dataHealthReviews)
      .where(inArray(schema.dataHealthReviews.entityId, uniqueIds))
      .catch(() => []);
    const reviewedDocumentIds = new Set(reviewRows.filter((row) => row.status === "accepted" || row.status === "reviewed").map((row) => row.entityId));

    const chunkRows = await session.db
      .select({
        documentId: schema.billDocumentTextChunks.documentId,
        text: schema.billDocumentTextChunks.text
      })
      .from(schema.billDocumentTextChunks)
      .where(inArray(schema.billDocumentTextChunks.documentId, uniqueIds))
      .orderBy(asc(schema.billDocumentTextChunks.documentId), asc(schema.billDocumentTextChunks.chunkIndex));
    const textByDocument = new Map<string, string>();
    for (const row of chunkRows) {
      textByDocument.set(row.documentId, [textByDocument.get(row.documentId), row.text].filter(Boolean).join("\n"));
    }
    const result = new Map<string, SourceConfidence>();

    for (const document of documents) {
      const text = textByDocument.get(document.id) ?? "";
      const accepted = reviewedDocumentIds.has(document.id);
      const hasOpenIssue = document.textStatus === "stored" && !accepted && hasTextHealthIssue(text);
      result.set(document.id, confidenceForDocument({
        textStatus: document.textStatus,
        hasOpenIssue,
        reviewStatus: accepted ? "accepted" : undefined
      }));
    }
    return result;
  } finally {
    await session.close();
  }
}

function hasTextHealthIssue(text: string): boolean {
  return scoreOcrHealth({ text, chunkCount: text ? 1 : 0 }).reasons.length > 0 || parseBillText(text).warnings.length > 0;
}
