"""Provider protocol tests: deterministic HTTP fixtures, no real API calls."""
import json
import math
import unittest
from unittest.mock import patch

import httpx
from test_backend import ai


def stream(*frames, done=True):
    result = ': keepalive\n\n' + ''.join('data: ' + json.dumps(f) + '\n\n' for f in frames)
    return result + ('data: [DONE]\n\n' if done else '')


def delta(text=None, reason=None, **extra):
    return {'choices': [{'index': 0, 'delta': {'content': text, **extra}, 'finish_reason': reason}]}


class OpenRouterTests(unittest.TestCase):
    def client(self, handler):
        return httpx.Client(base_url=ai.API_BASE + '/', transport=httpx.MockTransport(handler))

    def test_embeddings_shape_query_type_and_normalization(self):
        for query in (False, True):
            def handler(request):
                body = json.loads(request.content)
                self.assertEqual(request.url.path, '/api/v1/embeddings')
                self.assertEqual(body['dimensions'], 768)
                self.assertEqual(body['input_type'], 'query' if query else 'passage')
                return httpx.Response(200, json={'data': [{'embedding': [1.] * 768}]})
            with patch.object(ai, 'MODE', 'model'), patch.object(ai, 'client', return_value=self.client(handler)):
                values = ai.embed('test', query=query)
            self.assertTrue(math.isclose(sum(v*v for v in values), 1))

    def test_invalid_vectors_rejected(self):
        for values in ([1.], [0.] * 768, ['bad'] * 768):
            with patch.object(ai, 'MODE', 'model'), patch.object(ai, 'client', return_value=self.client(lambda _: httpx.Response(200, json={'data': [{'embedding': values}]}))):
                with self.assertRaises(ai.ProviderError):
                    ai.embed('test')

    def test_stream_content_usage_and_request(self):
        def handler(request):
            body = json.loads(request.content)
            self.assertEqual(body['model'], ai.MODEL)
            self.assertTrue(body['stream'])
            self.assertIn('untrusted', body['messages'][0]['content'])
            self.assertEqual(json.loads(body['messages'][1]['content'])['sources'][0]['label'], 1)
            return httpx.Response(200, text=stream(delta(reasoning='private reasoning'), delta('Cedar '), delta('[1]', 'stop'), {'choices': [], 'usage': {'total_tokens': 12, 'prompt_tokens': 8, 'completion_tokens': 4}}))
        usage = {}
        with patch.object(ai, 'MODE', 'model'), patch.object(ai, 'client', return_value=self.client(handler)):
            self.assertEqual(''.join(ai.generate('name?', [{'content': 'Cedar'}], usage)), 'Cedar [1]')
        self.assertEqual(usage['total_token_count'], 12)

    def test_failed_and_incomplete_streams_rejected(self):
        for body in [stream(delta('partial'), done=False), stream(delta('partial')), stream(delta('partial', 'length')), stream({'error': {'message': 'private error'}}), 'data: invalid\n\n']:
            with patch.object(ai, 'MODE', 'model'), patch.object(ai, 'client', return_value=self.client(lambda _: httpx.Response(200, text=body))):
                with self.assertRaises(ai.ProviderError):
                    list(ai.generate('q', [{'content': 'text'}], {}))

    def test_auth_error_sanitized_and_not_retried(self):
        requests = []
        def handler(request):
            requests.append(request)
            return httpx.Response(401, text='secret provider body')
        with patch.object(ai, 'MODE', 'model'), patch.object(ai, 'client', return_value=self.client(handler)):
            with self.assertRaisesRegex(ai.ProviderError, 'HTTP 401') as caught:
                ai.embed('test')
        self.assertNotIn('secret', str(caught.exception))
        self.assertEqual(len(requests), 1)

    def test_transient_errors_only(self):
        with patch.object(ai, 'MODE', 'model'):
            self.assertTrue(ai.transient(ai.ProviderError('busy', 429)))
            self.assertTrue(ai.transient(httpx.ReadTimeout('timeout')))
            self.assertFalse(ai.transient(ai.ProviderError('auth', 401)))
            self.assertFalse(ai.transient(ValueError('bad vector')))

    def test_generator_close_closes_response(self):
        response = httpx.Response(200, text=stream(delta('Cedar'), delta(' [1]', 'stop')))
        connection = self.client(lambda _: response)
        with patch.object(ai, 'MODE', 'model'), patch.object(ai, 'client', return_value=connection):
            generator = ai.generate('q', [{'content': 'Cedar'}], {})
            self.assertEqual(next(generator), 'Cedar')
            generator.close()
        self.assertTrue(connection.is_closed)
        self.assertTrue(response.is_closed)
