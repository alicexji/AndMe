from io import BytesIO
from PIL import Image

AUTH = {"Authorization": "Bearer test-secret-key"}


def test_portrait_reads_history_and_new_observations(client):
    assert client.get('/api/portrait/observations').json()['observations'] == []
    for timestamp in ['2025-01-01T12:00:00Z', '2026-10-11T12:00:00Z']:
        assert client.post('/api/observations', headers=AUTH, json={
            'text': 'A quiet morning.', 'observed_at': timestamp}).status_code == 201
    records = client.get('/api/portrait/observations').json()['observations']
    assert len(records) == 2
    assert records[0]['received_at'].startswith('2025')
    assert records[0]['metadata']['word_count'] == 3
    assert records[0]['metadata']['source'] == 'apple_shortcuts'
    assert records[0]['metadata']['context']['submitted_observed_at']


def test_photo_metadata_and_unreadable_original(client):
    image = Image.new('RGB', (48, 32))
    exif = Image.Exif()
    exif[271] = 'Test camera'
    buffer = BytesIO()
    image.save(buffer, format='JPEG', exif=exif)
    for content in [buffer.getvalue(), b'preserved but not decodable']:
        response = client.post('/api/observations/photo', headers=AUTH,
                               files={'photo': ('photo.jpg', content, 'image/jpeg')})
        assert response.status_code == 201
    records = client.get('/api/portrait/observations').json()['observations']
    first = records[0]['metadata']['media'][0]
    assert (first['width'], first['height']) == (48, 32)
    assert first['exif']['Make'] == 'Test camera'
    assert len(first['sha256']) == 64
    assert records[1]['metadata']['media'][0]['status'] == 'unavailable'
