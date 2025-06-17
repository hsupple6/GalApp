import './BuyGalacticaModal.scss';

import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import bedrockBoxImage from '../../../assets/bedrockbox.png';
import bedrockBoxPortalImage from '../../../assets/bedrockboxPortal.png';
import ModalWrapper from '../../../components/ModalWrapper';

interface BuyGalacticaModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Initialize Stripe
const stripePublicKey = process.env.REACT_APP_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

const BuyGalacticaModal: React.FC<BuyGalacticaModalProps> = ({
    isOpen,
    onClose,
}) => {
    const [selectedModel, setSelectedModel] = useState<'Gal' | 'Gal + Portal'>('Gal');
    const [email, setEmail] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = (e: Event) => {
            const modal = modalRef.current;
            if (!modal) return;

            const moon = modal.querySelector('.moon') as HTMLElement;
            if (!moon) return;

            const scrollPercent = (modal.scrollTop / (modal.scrollHeight - modal.clientHeight)) * 100;
            
            // Create a more dramatic parallax effect
            const translateY = Math.min(scrollPercent * 3, 200); // Move moon up to 200px
            const translateX = Math.min(scrollPercent * 1.5, 100); // Move moon left up to 100px
            const scale = Math.max(1 - (scrollPercent * 0.003), 0.7); // Slightly shrink as it moves
            const rotate = scrollPercent * 0.5; // Slight rotation as it moves
            
            // Update moon position with smooth transform
            moon.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotate}deg)`;
        };

        const modalElement = modalRef.current;
        if (modalElement) {
            modalElement.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (modalElement) {
                modalElement.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    const handleReserve = async () => {
        try {
            if (!stripePromise) {
                console.error('Stripe is not initialized. Please check your environment variables.');
                alert('Payment processing is not available at the moment. Please try again later.');
                return;
            }
            
            const stripe = await stripePromise;
            if (!stripe) throw new Error('Stripe failed to initialize');

            // TODO: Replace with actual API endpoint
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: selectedModel,
                    email,
                }),
            });

            const session = await response.json();

            // Redirect to Stripe Checkout
            const result = await stripe.redirectToCheckout({
                sessionId: session.id,
            });

            if (result.error) {
                console.error('Error:', result.error);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title="Reserve Your Gal Now"
        >
            <div className="buy-galactica-modal" ref={modalRef}>
                <div className="space-background">
                    <div className="stars"></div>
                    <div className="moon"></div>
                </div>
                <div className="modal-header">
                    <h1>Own Your Future. Own Your Ai.</h1>
                    <p className="header-subtitle">
                        Meet Gal—a revolutionary AI operating platform.<br />
                        Unlimited queries, total power, and complete privacy.
                    </p>
                </div>

                {/* Model Selection */}
                <section className="section-vehicle">
                    
                    <div className="model-options">
                        <div 
                            className={`model-card ${selectedModel === 'Gal' ? 'selected' : ''}`}
                            onClick={() => setSelectedModel('Gal')}
                        >
                            <div className="radio-selector"></div>
                            <h3>Gal</h3>
                            <p className="model-description">A PERSONAL AI COMPUTER</p>
                            <p className="price">Includes the Base unit - your personal AI computer with powerful local processing. Starting as low as $5,000</p>
                            <p className="availability">Initial production targeted for 2024*</p>
                            <div className="model-image">
                                <img src={bedrockBoxImage} alt="Galactica I Base Unit" />
                            </div>
                        </div>
                        <div 
                            className={`model-card ${selectedModel === 'Gal + Portal' ? 'selected' : ''}`}
                            onClick={() => setSelectedModel('Gal + Portal')}
                        >
                            <div className="radio-selector"></div>
                            <h3>Gal + Portal</h3>
                            <p className="model-description">A COMPLETE AI WORKSTATION</p>
                            <p className="price">Includes Base unit + Portal - a 27" standalone AI tablet that works independently or as a display. Starting as low as $7,000</p>
                            <p className="availability">Initial production targeted for 2024*</p>
                            <div className="model-image">
                                <img src={bedrockBoxPortalImage} alt="Galactica Portal Display" className="portal-image" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Specs Section */}
                <section className="section-specs">
                    <h2>SPECIFICATIONS</h2>
                    <div className="specs-options">
                        <div className="specs-group">
                            <h3>Base Unit</h3>
                            <ul>
                                <li>Custom AI Processing Unit</li>
                                <li>Neural Engine Core</li>
                                <li>Advanced Machine Learning Accelerator</li>
                                <li>32GB Unified Memory</li>
                                <li>1TB NVMe SSD</li>
                            </ul>
                        </div>
                        <div className="specs-group">
                            <h3>Portal Client</h3>
                            <ul>
                                <li>27" Retina Display</li>
                                <li>Standalone AI Processing</li>
                                <li>Wireless Connectivity</li>
                                <li>Touch & Pencil Support</li>
                                <li>Built-in Battery</li>
                            </ul>
                        </div>
                        <div className="specs-group">
                            <h3>Connectivity</h3>
                            <ul>
                                <li>Wi-Fi 6E</li>
                                <li>Bluetooth 5.3</li>
                                <li>10Gb Ethernet</li>
                                <li>Thunderbolt 4 Ports</li>
                                <li>Secure Enclave</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Reservation Fee */}
                <section className="section-fee">
                    <h2>RESERVATION FEE DUE TODAY</h2>
                    <div className="fee-amount">
                        <h3>$100 USD</h3>
                        <p>Secure your spot. Your reservation fee is refundable until your order is confirmed. Options and pricing may change.</p>
                    </div>
                </section>

                {/* Email for Stripe */}
                <section className="section-email">
                    <h2>YOUR EMAIL</h2>
                    <input 
                        type="email" 
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="email-input"
                    />
                </section>

                {/* Reserve Button */}
                <button 
                    className="reserve-button" 
                    onClick={handleReserve}
                    disabled={!email}
                >
                    PROCEED TO PAYMENT
                </button>

                {/* Terms and Conditions */}
                <p className="terms">
                    By continuing my reservation, I have read and agree to the Reservation Agreement, Terms and Data Privacy Notice. 
                    Pricing, available options, and specs are subject to change until we build your actual device.
                </p>
            </div>
        </ModalWrapper>
    );
};

export default BuyGalacticaModal; 