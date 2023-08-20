interface PSImplentingEntity extends IEngineAffectedEntity {}

interface PSDependentEntity extends IEngineAffectedEntity {}

interface PSMemoryData extends IEngineInnovationMemoryData {}

interface PSPolicyFeedback {
  source: "AI" | "Policymaker" | "Citizen";
  feedback: string;
  timestamp: Date;
}

interface PSPolicyReference {
  title: string;
  source: string;
  link?: URL;
}

type PSEvidenceWebPageTypes =
  | "positiveEvidence"
  | "negativeEvidence"
  | "neutralEvidence"
  | "economicEvidence"
  | "scientificEvidence"
  | "culturalEvidence"
  | "environmentalEvidence"
  | "legalEvidence"
  | "technologicalEvidence"
  | "geopoliticalEvidence"

  | "caseStudies"

  | "stakeholderOpinions"
  | "expertOpinions"
  | "publicOpinions"

  | "historicalContext"
  | "ethicalConsiderations"

  | "longTermImpact"
  | "shortTermImpact"

  | "localPerspective"
  | "globalPerspective"

  | "costAnalysis"
  | "implementationFeasibility";

type SearchResultItem = IEngineSearchResultItem[];

type PSEvidenceSearchResults = {
  [K in PSEvidenceWebPageTypes]: SearchResultItem;
};

type PSEvidenceSearchQueries = {
  [K in PSEvidenceWebPageTypes]: string[];
};

interface PSPolicyStage {
  description: string;
  eloRating?: number;
  actions?: PSPolicyAction[];
}

interface PSPolicyAction {
  description: string;
  eloRating?: number;
  implementingEntities: PSImplentingEntity[];
  dependentOnEntities: PSDependentEntity[];
  evidenceSearchQueries?: IEngineSearchQueries;
  evidenceSearchResults?: PSEvidenceSearchResults;
}

interface PSEvidenceRawWebPageData {
  mostRelevantParagraphs: string[];
  possibleRawEvidenceIdentifiedInTextContext?: string[];

  possibleRawCaseStudiesIdentifiedInTextContext?: string[];
  possibleRawStakeholderOpinionsIdentifiedInTextContext?: string[];
  possibleRawExpertOpinionsIdentifiedInTextContext?: string[];
  possibleRawPublicOpinionsIdentifiedInTextContext?: string[];

  possibleRawHistoricalContextIdentifiedInTextContext?: string[];
  possibleRawEthicalConsiderationsIdentifiedInTextContext?: string[];

  possibleRawLongTermImpactIdentifiedInTextContext?: string[];
  possibleRawShortTermImpactIdentifiedInTextContext?: string[];

  possibleRawLocalPerspectiveIdentifiedInTextContext?: string[];
  possibleRawGlobalPerspectiveIdentifiedInTextContext?: string[];

  possibleRawImplementationFeasibilityIdentifiedInTextContext?: string[];

  relevanceToPolicyProposal: string;
  confidenceScore?: number;
  relvanceScore?: number;
  qualityScore?: number;
  tags?: string[];
  entities?: string[];
  contacts?: string[];
  summary: string;
  url: string;
  searchType: PSEvidenceWebPageTypes;
  subProblemIndex?: number;
  entityIndex?: number;
  groupId: number;
  communityId: number;
  domainId: number;
  _additional?: {
    distance: number;
    id?: string;
  };
}

interface PSEvidenceWebPageAnalysisData {
  rawWebPageDataId: string;
  implicationsForPolicy: string[];
  relevanceToPolicy: string;
  biasesOrLimitations: string[];
}

interface PSPolicyRisk {
  riskDescription: string;
  likelihood: "High" | "Medium" | "Low";
  impact: "High" | "Medium" | "Low";
  mitigationStrategies: string[];
}

interface PSCulturalSocialImpact {
  potentialImpact: string;
  affectedGroups: string[]; // e.g., 'Minorities', 'Rural Communities'
  recommendations: string[];
}

interface PSEconomicImpact {
  projectedEconomicBenefit: number; // e.g., in $ amount or other relevant metric
  potentialCosts: number;
  ROI: number; // Return on Investment
}

interface PSEconomicImpactQualitative {
  potentialEconomicBenefits: string[]; // e.g., ['Job creation in rural areas', 'Boost in local manufacturing']
  potentialEconomicConcerns: string[]; // e.g., ['Potential job loss in sector X', 'Inflationary concerns']
  recommendedEconomicStudies: string[]; // e.g., ['Study on job creation in rural areas', 'Research on impact on small businesses']
}

interface PSLegalConsideration {
  legalConstraint: string;
  implications: string;
}

interface PSEnvironmentalConsideration {
  potentialEnvironmentalImpact: string;
  sustainabilityRecommendations: string[];
}

interface PSTechnologicalDependency {
  technologyName: string;
  roleInPolicy: string; // e.g., 'Monitoring', 'Implementation'
  reliability: "High" | "Medium" | "Low";
}

interface PSPolicy {
  subProblemIndex: number;
  solutionIndex: string;
  title: string;
  description: string;
  fullDescription?: string;
  conditionsForSuccess: string[];
  mainObstaclesForImplemention: string[];
  mainRisks: string[];
  policyKPIMetrics: string[];
  whyTheBestChoice?: string;
  imagePrompt?: string;
  imageUrl?: string;
  eloRating?: number;
  reaped?: boolean;
  similarityGroup?: IEngineSimilarityGroup;
  isFirstInGroup?: boolean;
  implementingEntities: PSImplentingEntity[];
  dependentOnEntities: PSDependentEntity[];
  evidenceSearchQueries?: PSEvidenceSearchQueries;
  evidenceSearchResults?: PSEvidenceSearchResults;
  stages?: PSPolicyStage[];
  environmentConsiderations?: PSEnvironmentalConsideration[];
  culturalSocialImpacts?: PSCulturalSocialImpact[];
  economicImpactsQualitative?: PSEconomicImpactQualitative[];
  legalConsiderations?: PSLegalConsideration[];
  technologicalDependencies?: PSTechnologicalDependency[];
  ratings?: object;
  family?: {
    parentA?: string; // "<generationIndex>:<solutionId>"
    parentB?: string;
    mutationRate?: IEngineMutationRates;
    gen?: number;
  };
}
