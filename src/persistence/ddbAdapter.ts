import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import type { PersistenceAdapter } from './adapter';
import type { TournamentState } from '../state/types';

export class DdbAdapter implements PersistenceAdapter {
  private doc: DynamoDBDocumentClient;
  private tableName: string;

  constructor(opts: { region: string; identityPoolId: string; tableName: string }) {
    const credentials = fromCognitoIdentityPool({
      identityPoolId: opts.identityPoolId,
      clientConfig: { region: opts.region },
    });
    const client = new DynamoDBClient({ region: opts.region, credentials });
    this.doc = DynamoDBDocumentClient.from(client);
    this.tableName = opts.tableName;
  }

  async load(tournamentId: string): Promise<TournamentState | null> {
    const res = await this.doc.send(new GetCommand({
      TableName: this.tableName,
      Key: { tournamentId },
    }));
    return (res.Item as TournamentState | undefined) ?? null;
  }

  async save(state: TournamentState): Promise<void> {
    await this.doc.send(new PutCommand({
      TableName: this.tableName,
      Item: state,
    }));
  }
}
