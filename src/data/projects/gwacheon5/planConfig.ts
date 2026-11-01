import { ProjectPlanConfig } from '../../../types/planConfig.ts';
import { FirestoreUnitTypeDoc } from '../../../schema/firestoreSchema.ts';

const projectId = 'gwacheon-5';
const sourceId = 'gwacheon5-user-supplied-20261014';
const planVersionId = 'gwacheon5-user-supplied-v1';
const uploadedAt = '2026-10-14';
const sourceName = '사용자 제공 과천 5단지 배치도·평면도';
const notice = '사용자 제공 자료입니다. 발행일·인허가 확정 여부·타입별 세대수·동별 배정은 미확인입니다.';
const files = [{"fileName": "84a.jpg", "typeCode": "84A", "areaGroup": "84"}, {"fileName": "84b-1.jpg", "typeCode": "84B-1", "areaGroup": "84"}, {"fileName": "84b-2.jpg", "typeCode": "84B-2", "areaGroup": "84"}, {"fileName": "84c.jpg", "typeCode": "84C", "areaGroup": "84"}, {"fileName": "84d.jpg", "typeCode": "84D", "areaGroup": "84"}, {"fileName": "84e.jpg", "typeCode": "84E", "areaGroup": "84"}, {"fileName": "84f-1.jpg", "typeCode": "84F-1", "areaGroup": "84"}, {"fileName": "84f-2.jpg", "typeCode": "84F-2", "areaGroup": "84"}, {"fileName": "84g.jpg", "typeCode": "84G", "areaGroup": "84"}, {"fileName": "99a.jpg", "typeCode": "99A", "areaGroup": "99"}, {"fileName": "99b.jpg", "typeCode": "99B", "areaGroup": "99"}, {"fileName": "99c.jpg", "typeCode": "99C", "areaGroup": "99"}, {"fileName": "99d-1.jpg", "typeCode": "99D-1", "areaGroup": "99"}, {"fileName": "99d-2.jpg", "typeCode": "99D-2", "areaGroup": "99"}, {"fileName": "99e.jpg", "typeCode": "99E", "areaGroup": "99"}, {"fileName": "109a.jpg", "typeCode": "109A", "areaGroup": "109"}, {"fileName": "109c.jpg", "typeCode": "109C", "areaGroup": "109"}, {"fileName": "122.jpg", "typeCode": "122", "areaGroup": "122"}, {"fileName": "125a.jpg", "typeCode": "125A", "areaGroup": "125"}, {"fileName": "125b.jpg", "typeCode": "125B", "areaGroup": "125"}, {"fileName": "125c.jpg", "typeCode": "125C", "areaGroup": "125"}, {"fileName": "135a.jpg", "typeCode": "135A", "areaGroup": "135"}, {"fileName": "135b.jpg", "typeCode": "135B", "areaGroup": "135"}, {"fileName": "142.jpg", "typeCode": "142", "areaGroup": "142"}, {"fileName": "144.jpg", "typeCode": "144", "areaGroup": "144"}, {"fileName": "145.jpg", "typeCode": "145", "areaGroup": "145"}, {"fileName": "148.jpg", "typeCode": "148", "areaGroup": "148"}];
const unitTypes: FirestoreUnitTypeDoc[] = files.map(({fileName, typeCode, areaGroup}) => {
  const assetId = `asset-gwacheon5-${typeCode}`;
  const imageUrl = `/assets/plans/gwacheon5/${fileName}`;
  return {
    unitTypeId: `gwacheon5-${typeCode}`, typeName: typeCode, typeCode,
    units: 0, projectId, planVersionId, areaGroup, netAreaM2: null,
    floorPlanAssetId: assetId, locationMapIncludedInOriginal: false,
    specialFeatures: [], verificationStatus: 'unverified', confirmationStatus: 'proposal',
    verifiedFacts: {typeName: typeCode, units: 0, areaGroup, sourceType: 'user-supplied',
      evidence: '업로드된 이미지와 파일명 확인. 세대수는 미확인 값.',
      hasLocationMap: false, verificationStatus: 'verified', confirmationStatus: 'proposal'},
    sourceAsset: {assetId, originalFileName: fileName, assetType: 'floor_plan',
      imageUrl, assetPath: imageUrl, primaryAssetPath: imageUrl,
      sourceAssetVerified: true, fileExists: true},
    provenance: {sourceType: 'user-supplied', sourceName, documentTitle: sourceName, publishedDate: null},
    mappingStatus: 'unresolved', evidenceSourceId: sourceId,
    unverifiedAttributesNotice: notice, createdAt: uploadedAt,
  };
});

export const gwacheon5PlanConfig: ProjectPlanConfig = {
  projectId, projectName: '과천주공 5단지 재건축', displayName: '과천 5단지',
  capabilities: {hasSitePlan: true, hasUnitPlans: true, hasUnitComparison: true,
    hasInteractiveCoordinates: true, hasBuildingMappings: true, hasSupplyAllocation: false},
  availability: {sitePlan: 'normalized', unitPlans: 'normalized', unitComparison: 'normalized',
    buildingMappings: 'normalized', supplyAllocation: 'source_not_available'},
  documentStatus: 'unknown',
  evidenceSources: [{sourceId, sourceType: 'user-supplied', title: sourceName,
    issuer: '사용자 제공', documentStatus: 'unknown', verificationStatus: 'unverified',
    assetVerificationStatus: 'verified', metadataVerificationStatus: 'unverified',
    publishedAt: null, evidenceNotes: '과천5단지.zip: 배치도 1장, 평면도 27종. 원본 JPG 유지.'}],
  planVersion: {planVersionId, projectId, versionName: sourceName,
    sourceType: 'user-supplied', sourceName, documentTitle: sourceName,
    publishedDate: null, sourceDate: null, confirmationStatus: 'proposal', verificationStatus: 'unverified',
    isCurrentKnownVersion: true, supersededBy: null, totalUnitsInPlanSet: 0,
    discrepancyNotice: notice, versionNotice: notice, totalUnitTypesCount: 27,
    layoutPlanAssetId: 'asset-gwacheon5-site', sitePlanAssetId: 'asset-gwacheon5-site',
    evidenceSourceId: sourceId, createdAt: uploadedAt, verifiedAt: uploadedAt},
  areaGroups: [...new Set(files.map(f => f.areaGroup))].map(groupCode => ({
    groupCode, name: `${groupCode}㎡`, totalUnits: 0,
    types: files.filter(f => f.areaGroup === groupCode).map(f => f.typeCode)})),
  unitTypes,
  sitePlan: {sitePlanId: 'gwacheon5-site', projectId,
    assetPath: '/assets/plans/gwacheon5/site-plan.jpg', sourceType: 'user-supplied',
    confirmationStatus: 'proposal', verificationStatus: 'verified-from-image',
    isCurrentKnownVersion: true, title: '과천 5단지 배치도 (사용자 제공)',
    versionNotice: notice, totalBuildingsCount: 7, totalUnitTypesMapped: 0,
    evidenceSourceId: sourceId, uploadedAt, verifiedAt: uploadedAt},
  buildings: [{"buildingId": "gwacheon5-501", "projectId": "gwacheon-5", "sitePlanId": "gwacheon5-site", "buildingNumber": "501동", "displayName": "501동", "unitTypesShown": [], "isTerraceHouse": false, "notes": "사용자 제공 배치도에서 동 번호 및 위치 확인. 타입별 동 배정은 미확인."}, {"buildingId": "gwacheon5-502", "projectId": "gwacheon-5", "sitePlanId": "gwacheon5-site", "buildingNumber": "502동", "displayName": "502동", "unitTypesShown": [], "isTerraceHouse": false, "notes": "사용자 제공 배치도에서 동 번호 및 위치 확인. 타입별 동 배정은 미확인."}, {"buildingId": "gwacheon5-503", "projectId": "gwacheon-5", "sitePlanId": "gwacheon5-site", "buildingNumber": "503동", "displayName": "503동", "unitTypesShown": [], "isTerraceHouse": false, "notes": "사용자 제공 배치도에서 동 번호 및 위치 확인. 타입별 동 배정은 미확인."}, {"buildingId": "gwacheon5-504", "projectId": "gwacheon-5", "sitePlanId": "gwacheon5-site", "buildingNumber": "504동", "displayName": "504동", "unitTypesShown": [], "isTerraceHouse": false, "notes": "사용자 제공 배치도에서 동 번호 및 위치 확인. 타입별 동 배정은 미확인."}, {"buildingId": "gwacheon5-505", "projectId": "gwacheon-5", "sitePlanId": "gwacheon5-site", "buildingNumber": "505동", "displayName": "505동", "unitTypesShown": [], "isTerraceHouse": false, "notes": "사용자 제공 배치도에서 동 번호 및 위치 확인. 타입별 동 배정은 미확인."}, {"buildingId": "gwacheon5-506", "projectId": "gwacheon-5", "sitePlanId": "gwacheon5-site", "buildingNumber": "506동", "displayName": "506동", "unitTypesShown": [], "isTerraceHouse": false, "notes": "사용자 제공 배치도에서 동 번호 및 위치 확인. 타입별 동 배정은 미확인."}, {"buildingId": "gwacheon5-507", "projectId": "gwacheon-5", "sitePlanId": "gwacheon5-site", "buildingNumber": "507동", "displayName": "507동", "unitTypesShown": [], "isTerraceHouse": false, "notes": "사용자 제공 배치도에서 동 번호 및 위치 확인. 타입별 동 배정은 미확인."}], coordinates: [{"buildingNumber": "501동", "normalizedX": 0.34783, "normalizedY": 0.72217, "coordinateStatus": "verified", "sitePlanId": "gwacheon5-site", "confirmationStatus": "proposal", "label": "501", "isTerraceHouse": false}, {"buildingNumber": "502동", "normalizedX": 0.51103, "normalizedY": 0.72217, "coordinateStatus": "verified", "sitePlanId": "gwacheon5-site", "confirmationStatus": "proposal", "label": "502", "isTerraceHouse": false}, {"buildingNumber": "503동", "normalizedX": 0.67234, "normalizedY": 0.72217, "coordinateStatus": "verified", "sitePlanId": "gwacheon5-site", "confirmationStatus": "proposal", "label": "503", "isTerraceHouse": false}, {"buildingNumber": "504동", "normalizedX": 0.5753, "normalizedY": 0.54141, "coordinateStatus": "verified", "sitePlanId": "gwacheon5-site", "confirmationStatus": "proposal", "label": "504", "isTerraceHouse": false}, {"buildingNumber": "505동", "normalizedX": 0.65469, "normalizedY": 0.3455, "coordinateStatus": "verified", "sitePlanId": "gwacheon5-site", "confirmationStatus": "proposal", "label": "505", "isTerraceHouse": false}, {"buildingNumber": "506동", "normalizedX": 0.44865, "normalizedY": 0.31968, "coordinateStatus": "verified", "sitePlanId": "gwacheon5-site", "confirmationStatus": "proposal", "label": "506", "isTerraceHouse": false}, {"buildingNumber": "507동", "normalizedX": 0.35917, "normalizedY": 0.44078, "coordinateStatus": "verified", "sitePlanId": "gwacheon5-site", "confirmationStatus": "proposal", "label": "507", "isTerraceHouse": false}], recommendedComparisons: [],
  notices: [notice, '평면도는 확보된 27종만 제공합니다. 84B-1·84B-2, 84F-1·84F-2, 99D-1·99D-2는 별도 타입으로 유지합니다.',
    '평면도 원본은 가로 900픽셀입니다. 확대 시 작은 글자가 흐릴 수 있습니다.'],
};
