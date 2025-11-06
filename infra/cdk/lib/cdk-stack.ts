import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

type BucketConfig = {
  id: string;
  bucketName: string;
};

const BUCKET_TRANSITION_DAYS = 30;

const BUCKETS: BucketConfig[] = [
  { id: "Dev", bucketName: "econn-content-dev" },
  { id: "Prod", bucketName: "econn-content-prod" },
];

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    BUCKETS.forEach((config) => {
      const bucket = new s3.Bucket(this, `${config.id}ContentBucket`, {
        bucketName: config.bucketName,
        versioned: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
        enforceSSL: true,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        lifecycleRules: [
          {
            id: "TransitionToStandardIa",
            transitions: [
              {
                storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                transitionAfter: Duration.days(BUCKET_TRANSITION_DAYS),
              },
            ],
          },
        ],
        removalPolicy: RemovalPolicy.RETAIN,
        autoDeleteObjects: false,
      });

      bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "AllowPublicReadPuzzles",
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions: ["s3:GetObject"],
          resources: [
            bucket.arnForObjects("puzzles/*"),
            bucket.arnForObjects("manifest.json"),
          ],
        }),
      );

      new CfnOutput(this, `${config.id}BucketName`, {
        value: bucket.bucketName,
        description: `${config.id.toLowerCase()} puzzle content bucket`,
        exportName: `${config.id.toLowerCase()}-puzzle-content-bucket`,
      });
    });
  }
}
