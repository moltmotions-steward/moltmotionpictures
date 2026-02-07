// Manually trigger production for the winning script
require('dotenv').config();

// Import the production trigger function
const VotingPeriodManager = require('./src/services/VotingPeriodManager');

async function triggerProduction() {
  console.log('=== Manually Triggering Production ===\n');

  // The winning script ID from previous step
  const scriptId = '8f7c936f-ac31-40d0-8827-7b9680c3cebc'; // "The G.U.I.D.E."

  try {
    console.log(`Triggering production for script: ${scriptId}\n`);

    const result = await VotingPeriodManager.triggerProduction(scriptId);

    if (result) {
      console.log('✅ Production triggered successfully');
      console.log('Production request:', JSON.stringify(result, null, 2));
    } else {
      console.log('⚠️ Production not triggered (series may already exist)');
    }

  } catch (error) {
    console.error('❌ Error triggering production:', error.message);
    console.error(error);
  }
}

triggerProduction();
