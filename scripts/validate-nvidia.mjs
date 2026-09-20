// Using native fetch (Node 18+)

const API_KEY = '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';
const BASE_URL = 'https://integrate.api.nvidia.com/v1';

async function testEmbeddings() {
  console.log('Testing NVIDIA Embeddings API...');
  
  // Try different embedding models from the list
  const embeddingModels = [
    'nvidia/nemotron-3-embed-1b',
    'snowflake/arctic-embed-l',
    'nvidia/llama-3.2-nv-embedqa-1b-v1',
    'nvidia/llama-nemotron-embed-vl-1b-v2',
  ];

  for (const model of embeddingModels) {
    try {
      const resp = await fetch(`${BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          input: 'test embedding',
          encoding_format: 'float'
        })
      });
      console.log(`\nEmbeddings (${model}) status:`, resp.status);
      if (resp.ok) {
        const data = await resp.json();
        console.log('Embedding dim:', data.data?.[0]?.embedding?.length);
        console.log('SUCCESS: Working embedding model found:', model);
        break;
      } else {
        const text = await resp.text();
        console.log('Error:', text);
      }
    } catch (e) {
      console.log(`Embeddings (${model}) error:`, e.message);
    }
  }

  // Also test structured output with nemotron
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
        messages: [
          { role: 'system', content: 'Output only valid JSON with fields: name (string), score (number), tags (array of strings)' },
          { role: 'user', content: 'Create a sample opportunity assessment' }
        ],
        max_tokens: 200,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    console.log('\nStructured output (nemotron) status:', resp.status);
    if (resp.ok) {
      const data = await resp.json();
      console.log('Response:', data.choices?.[0]?.message?.content);
    } else {
      const text = await resp.text();
      console.log('Error:', text);
    }
  } catch (e) {
    console.log('Structured output error:', e.message);
  }
}

testEmbeddings();