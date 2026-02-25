import React, { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

const QuickScanHandler: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('qrToken');
    const params = new URLSearchParams();

    if (sessionId) {
      params.set('sessionId', sessionId);
    }

    if (token) {
      params.set('token', token);
    }

    const target = params.toString() ? `/scan?${params.toString()}` : '/scan';
    navigate(target, { replace: true });
  }, [navigate, searchParams, sessionId]);

  return null;
};

export default QuickScanHandler;

