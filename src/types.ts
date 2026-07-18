export interface DataRow {
  Region: string;
  "BU Line": string;
  "Brand Name": string;
  "Therapy Area": string;
  Category: string;
  Assignees: string;
  Month: string;
  "Sales Value": number;
  "Target Value": number;
  "Past Year Value": number;
}

export interface FilterState {
  Region: string[];
  "BU Line": string[];
  "Brand Name": string[];
  "Therapy Area": string[];
  Category: string[];
  Month: string[];
}

export interface PPTSlideConfig {
  id: string;
  title: string;
  insight: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

