
import { v1beta1 } from '@google-cloud/aiplatform';

async function inspect() {
    console.log('Inspecting PredictionServiceClient (v1beta1)...');
    try {
        const client = new v1beta1.PredictionServiceClient({
            projectId: 'gen-lang-client-0645888032',
            apiEndpoint: 'us-central1-aiplatform.googleapis.com'
        });
        
        console.log('Methods on client instance:');
        const proto = Object.getPrototypeOf(client);
        const props = Object.getOwnPropertyNames(proto);
        props.forEach(p => console.log(` - ${p}`));

    } catch (e: any) {
        console.error('Error instantiating client:', e.message);
    }
}

inspect();
