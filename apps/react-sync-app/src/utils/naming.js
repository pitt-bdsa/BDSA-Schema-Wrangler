// Function to generate normalized names using BDSA protocol data
export const generateNormalizedName = (item, bdsaNamingTemplate) => {
  const bdsaCaseId = item.bdsaCaseId || 'unknown';
  const bdsaRegionProtocol = (item.BDSA?.bdsaLocal?.bdsaRegionProtocol && item.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0)
    ? item.BDSA.bdsaLocal.bdsaRegionProtocol[0]
    : 'unknown';
  const bdsaStainProtocol = (item.BDSA?.bdsaLocal?.bdsaStainProtocol && item.BDSA.bdsaLocal.bdsaStainProtocol.length > 0)
    ? item.BDSA.bdsaLocal.bdsaStainProtocol[0]
    : 'unknown';

  console.log('🔍 Naming debug:', {
    template: bdsaNamingTemplate,
    bdsaCaseId,
    bdsaRegionProtocol,
    bdsaStainProtocol,
    itemBDSA: item.BDSA,
    itemBdsaLocal: item.BDSA?.bdsaLocal
  });

  // Extract file extension from original name
  const originalName = item.name || 'unknown';
  const fileExtension = originalName.includes('.') ? originalName.split('.').pop() : '';
  const baseName = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
  
  let result = bdsaNamingTemplate
    .replace('{bdsaCaseId}', bdsaCaseId)
    .replace('{bdsaRegionProtocol}', bdsaRegionProtocol)
    .replace('{bdsaStainProtocol}', bdsaStainProtocol)
    .replace('{region}', bdsaRegionProtocol)  // Also support shorter placeholders
    .replace('{stain}', bdsaStainProtocol)    // Also support shorter placeholders
    .replace('{originalName}', baseName);     // Use base name without extension
  
  // Add the original file extension if it exists
  if (fileExtension) {
    result += `.${fileExtension}`;
  }

  console.log('🔍 Naming result:', result);
  return result;
};
